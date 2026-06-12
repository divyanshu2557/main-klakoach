export { useRouter } from "./router";
export type { Page } from "./router";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAccessToken, type Product } from "../lib/api";
import { useSSE } from "./sse";

// ── Session ──────────────────────────────────────────────────────────────────
type SessionState = {
  token: string | null;
  role: string | null;
  artisanId: string | null;
  setSession: (token: string, role: string, artisanId?: string) => void;
  clearSession: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: null,
  role: null,
  artisanId: null,
  setSession: (token, role, artisanId) => {
    setAccessToken(token);
    set({ token, role, artisanId: artisanId ?? null });
    // Connect SSE for real-time notifications
    useSSE.getState().connect(token);
  },
  clearSession: () => {
    setAccessToken(null);
    set({ token: null, role: null, artisanId: null });
    // Disconnect SSE
    useSSE.getState().disconnect();
  },
}));

// ── Cart ─────────────────────────────────────────────────────────────────────
type CartItem = { product: Product; quantity: number };
type CartState = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (product: Product, qty?: number) => void;
  remove: (productId: string) => void;
  update: (productId: string, qty: number) => void;
  clear: () => void;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      setOpen: (v) => set({ open: v }),
      add: (product, qty = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.product.id === product.id);
        if (existing) {
          set({ items: items.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i) });
        } else {
          set({ items: [...items, { product, quantity: qty }], open: true });
        }
      },
      remove: (productId) => set({ items: get().items.filter((i) => i.product.id !== productId) }),
      update: (productId, qty) => {
        if (qty <= 0) { get().remove(productId); return; }
        set({ items: get().items.map((i) => i.product.id === productId ? { ...i, quantity: qty } : i) });
      },
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.product.price_cents * i.quantity, 0),
    }),
    { name: "klakoach-cart" }
  )
);

// ── Wishlist ──────────────────────────────────────────────────────────────────
type WishlistState = {
  ids: Set<string>;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: new Set<string>(),
      toggle: (id) => {
        const ids = new Set(get().ids);
        ids.has(id) ? ids.delete(id) : ids.add(id);
        set({ ids });
      },
      has: (id) => get().ids.has(id),
    }),
    {
      name: "klakoach-wishlist",
      storage: {
        getItem: (name) => {
          const s = localStorage.getItem(name);
          if (!s) return null;
          const parsed = JSON.parse(s) as { state: { ids: string[] } };
          return { state: { ids: new Set(parsed.state.ids) } };
        },
        setItem: (name, value) => {
          const v = value as { state: { ids: Set<string> } };
          localStorage.setItem(name, JSON.stringify({ state: { ids: [...v.state.ids] } }));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

// ── Filters ──────────────────────────────────────────────────────────────────
type FilterState = {
  wishlistOnly: boolean;
  setWishlistOnly: (v: boolean) => void;
  category: string;
  setCategory: (c: string) => void;
};

export const useFilterStore = create<FilterState>((set) => ({
  wishlistOnly: false,
  setWishlistOnly: (v) => set({ wishlistOnly: v }),
  category: "all",
  setCategory: (c) => set({ category: c }),
}));
