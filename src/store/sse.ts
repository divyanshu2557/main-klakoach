import { create } from "zustand";
import { getAccessToken, type AppNotification } from "../lib/api";

const BASE = "http://localhost:4000/api";

type SSEState = {
  connected: boolean;
  unreadCount: number;
  notifications: AppNotification[];
  connect: (token: string) => void;
  disconnect: () => void;
  markRead: (id: string) => void;
  _source: EventSource | null;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
  _reconnectDelay: number;
};

export const useSSE = create<SSEState>((set, get) => ({
  connected: false,
  unreadCount: 0,
  notifications: [],
  _source: null,
  _reconnectTimer: null,
  _reconnectDelay: 1000,

  connect: (token: string) => {
    // Close any existing connection
    get().disconnect();

    const url = `${BASE}/realtime/events?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.addEventListener("connected", () => {
      set({ connected: true, _reconnectDelay: 1000 });
    });

    source.addEventListener("notification", (e) => {
      try {
        const notif = JSON.parse(e.data) as AppNotification;
        set((s) => ({
          notifications: [notif, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        }));
      } catch { /* ignore malformed data */ }
    });

    source.addEventListener("error", () => {
      // Connection dropped — attempt reconnect with exponential backoff
      source.close();
      set({ connected: false, _source: null });

      const delay = get()._reconnectDelay;
      const timer = setTimeout(() => {
        const currentToken = getAccessToken();
        if (currentToken) {
          get().connect(currentToken);
        }
      }, delay);

      set({
        _reconnectTimer: timer,
        _reconnectDelay: Math.min(delay * 2, 30000),
      });
    });

    set({ _source: source });
  },

  disconnect: () => {
    const { _source, _reconnectTimer } = get();
    if (_source) {
      _source.close();
    }
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }
    set({
      connected: false,
      _source: null,
      _reconnectTimer: null,
      _reconnectDelay: 1000,
    });
  },

  markRead: (id: string) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },
}));
