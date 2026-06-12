import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };

type ToastStore = {
  toasts: Toast[];
  add: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
};

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],
  add: (message, type = "success") => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => get().remove(id), 3500);
  },
  remove: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

const icons: Record<ToastType, string> = { success: "✦", error: "✕", info: "◎" };
const colors: Record<ToastType, string> = {
  success: "border-[#d4a843]/30 bg-[#1a1510] text-[#e8dcc4]",
  error: "border-red-500/30 bg-[#1a0a0a] text-red-300",
  info: "border-[#d4c5a9]/20 bg-[#1a1510] text-[#d4c5a9]",
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 3500;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      className={`relative overflow-hidden rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-xl ${colors[toast.type]}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[#d4a843]">{icons[toast.type]}</span>
        <p className="text-sm font-medium">{toast.message}</p>
        <button onClick={onRemove} className="ml-auto text-xs opacity-40 hover:opacity-80">✕</button>
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 bg-[#d4a843]/40 transition-all" style={{ width: `${progress}%` }} />
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, remove } = useToast();
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 w-80">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => remove(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
