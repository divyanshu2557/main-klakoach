import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { api } from "../lib/api";
import { useCart } from "../store";
import { useToast } from "./Toast";

type Msg = { role: "user" | "assistant"; content: string; streaming?: boolean };

type ChatStore = { open: boolean; setOpen: (v: boolean) => void };
export const useChat = create<ChatStore>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const SESSION_ID = crypto.randomUUID();

const QUICK_PROMPTS = [
  "I need a gift under ₹3000",
  "Show me ceramic pieces",
  "What's new this week?",
  "Best sellers right now",
];

export function AIChatWidget() {
  const { open, setOpen } = useChat();
  const { add } = useCart();
  const { add: toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Welcome. I am your personal Klakoach Concierge. How may I assist you in curating your space today? 🏺" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setInput("");
    const newMessages: Msg[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await api.ai.chat(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        SESSION_ID
      );

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload) as { delta?: string; error?: string; action?: string; product?: any };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.action === "ADD_TO_CART" && parsed.product) {
              add(parsed.product);
              toast(`✦ ${parsed.product.title} added to cart!`, "success");
              assembled += `\n\n*Added ${parsed.product.title} to your cart!*`;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assembled, streaming: true };
                return copy;
              });
            }
            if (parsed.delta) {
              assembled += parsed.delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assembled, streaming: true };
                return copy;
              });
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: assembled, streaming: false };
        return copy;
      });
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again in a moment.", streaming: false };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 sm:bottom-6 left-6 z-[140] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#d4a843] to-[#b8892c] shadow-2xl shadow-[#d4a843]/30 transition hover:scale-105"
            aria-label="Open AI shopping assistant"
          >
            <svg className="h-6 w-6 text-[#1a1510]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-green-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[130] bg-black/30 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-24 sm:bottom-6 left-4 right-4 z-[140] mx-auto flex max-w-sm flex-col overflow-hidden rounded-3xl border border-[#d4c5a9]/15 bg-[#1a1510] shadow-2xl sm:left-6 sm:right-auto sm:w-96"
              style={{ maxHeight: "min(600px, 85vh)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#d4c5a9]/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#d4a843]/30 to-transparent">
                    <svg className="h-4 w-4 text-[#d4a843]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#e8dcc4]">AI Curator</p>
                    <p className="text-[10px] text-[#d4c5a9]/40">Powered by klakoach</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full border border-[#d4c5a9]/15 text-[#d4c5a9]/50 hover:border-[#d4c5a9]/30 hover:text-[#d4c5a9]/80"
                >
                  ✕
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      msg.role === "user"
                        ? "bg-[#d4c5a9] text-[#1a1510] font-medium"
                        : "bg-[#2a2218] text-[#d4c5a9]"
                    }`}>
                      {msg.content}
                      {msg.streaming && (
                        <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-[#d4a843]" />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts */}
              {messages.length <= 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-[#d4c5a9]/15 bg-[#2a2218] px-3 py-1.5 text-xs text-[#d4c5a9]/60 transition hover:border-[#d4c5a9]/30 hover:text-[#d4c5a9]/90"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-[#d4c5a9]/10 px-4 py-3">
                <div className="flex items-center gap-2 rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-4 py-2.5">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="Ask anything about our products…"
                    className="flex-1 bg-transparent text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30"
                  />
                  <button
                    onClick={() => send()}
                    disabled={!input.trim() || loading}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#d4a843] text-[#1a1510] transition hover:bg-[#e8b84e] disabled:opacity-40"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
