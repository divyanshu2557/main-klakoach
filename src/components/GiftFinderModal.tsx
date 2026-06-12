import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { api, type Product } from "../lib/api";
import { SmartImage } from "./SmartImage";
import { useCart } from "../store";
import { useToast } from "./Toast";

type GiftStore = { open: boolean; setOpen: (v: boolean) => void };
export const useGiftFinder = create<GiftStore>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

type GiftProduct = Product & { aiReason?: string };

const OCCASIONS = ["Birthday", "Anniversary", "Housewarming", "Diwali", "Wedding", "Thank You", "Just Because"];
const RECIPIENTS = ["Her", "Him", "Couple", "Parent", "Friend", "Child", "Colleague"];

const fmt = (cents: number) => `₹ ${(cents / 100).toLocaleString("en-IN")}`;

export function GiftFinderModal() {
  const { open, setOpen } = useGiftFinder();
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState("");
  const [recipient, setRecipient] = useState("");
  const [budget, setBudget] = useState([500, 5000]);
  const [interests, setInterests] = useState("");
  const [gifts, setGifts] = useState<GiftProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const { add } = useCart();
  const { add: toast } = useToast();

  const reset = () => { setStep(0); setOccasion(""); setRecipient(""); setBudget([500, 5000]); setInterests(""); setGifts([]); };

  const findGifts = async () => {
    setLoading(true);
    setStep(3);
    try {
      const result = await api.ai.giftFinder({ occasion, recipient, budgetMin: budget[0], budgetMax: budget[1], interests });
      setGifts(result.gifts);
    } catch {
      setGifts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setOpen(false); reset(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] grid place-items-center bg-[#1a1510]/80 px-4 backdrop-blur-2xl"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#d4c5a9]/15 bg-[#1a1510] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#d4c5a9]/10 px-7 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/40">AI Gift Finder</p>
                <h2 className="mt-1 font-serif text-2xl text-[#e8dcc4]">Find the perfect gift</h2>
              </div>
              <button onClick={handleClose} className="grid h-9 w-9 place-items-center rounded-full border border-[#d4c5a9]/15 text-[#d4c5a9]/50 hover:border-[#d4c5a9]/30">✕</button>
            </div>

            <div className="px-7 py-6">
              {/* Step indicators */}
              <div className="mb-7 flex items-center gap-2">
                {[0, 1, 2].map((s) => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${step > s ? "bg-[#d4a843]" : step === s ? "bg-[#d4a843]/60" : "bg-[#d4c5a9]/15"}`} />
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* Step 0 — Occasion */}
                {step === 0 && (
                  <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="mb-5 font-serif text-xl text-[#e8dcc4]">What's the occasion?</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {OCCASIONS.map((o) => (
                        <button
                          key={o}
                          onClick={() => { setOccasion(o); setStep(1); }}
                          className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                            occasion === o
                              ? "border-[#d4a843] bg-[#d4a843]/15 text-[#d4a843]"
                              : "border-[#d4c5a9]/15 bg-[#2a2218] text-[#d4c5a9]/70 hover:border-[#d4c5a9]/30 hover:text-[#e8dcc4]"
                          }`}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 1 — Recipient */}
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="mb-5 font-serif text-xl text-[#e8dcc4]">Who is it for?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {RECIPIENTS.map((r) => (
                        <button
                          key={r}
                          onClick={() => { setRecipient(r); setStep(2); }}
                          className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                            recipient === r
                              ? "border-[#d4a843] bg-[#d4a843]/15 text-[#d4a843]"
                              : "border-[#d4c5a9]/15 bg-[#2a2218] text-[#d4c5a9]/70 hover:border-[#d4c5a9]/30 hover:text-[#e8dcc4]"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStep(0)} className="mt-4 text-xs text-[#d4c5a9]/35 hover:text-[#d4c5a9]/60">← Back</button>
                  </motion.div>
                )}

                {/* Step 2 — Budget */}
                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="mb-5 font-serif text-xl text-[#e8dcc4]">What's your budget?</p>
                    <div className="mb-6 flex items-center justify-between text-sm text-[#d4c5a9]/60">
                      <span>₹500</span>
                      <span className="font-semibold text-[#e8dcc4]">₹500 – ₹{budget[1].toLocaleString("en-IN")}</span>
                      <span>₹20,000</span>
                    </div>
                    <input
                      type="range" min={500} max={20000} step={500}
                      value={budget[1]}
                      onChange={(e) => setBudget([budget[0], Number(e.target.value)])}
                      className="w-full accent-[#d4a843]"
                    />
                    <div className="mt-5">
                      <label className="block text-xs uppercase tracking-[0.2em] text-[#d4c5a9]/40 mb-2">Interests (optional)</label>
                      <input
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder="e.g. ceramics, home decor, textiles…"
                        className="w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] px-4 py-3 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/30"
                      />
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                      <button onClick={() => setStep(1)} className="text-xs text-[#d4c5a9]/35 hover:text-[#d4c5a9]/60">← Back</button>
                      <button
                        onClick={findGifts}
                        className="ml-auto rounded-full bg-[#d4a843] px-8 py-3 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8b84e]"
                      >
                        Find gifts ✦
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 — Results */}
                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4c5a9]/20 border-t-[#d4a843]" />
                        <p className="text-sm text-[#d4c5a9]/50">Finding perfect gifts for {recipient}…</p>
                      </div>
                    ) : gifts.length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-[#d4c5a9]/50">No products found in this budget range.</p>
                        <button onClick={reset} className="mt-4 text-sm text-[#d4a843] hover:text-[#e8b84e]">Try again →</button>
                      </div>
                    ) : (
                      <>
                        <p className="mb-5 text-sm text-[#d4c5a9]/50">{gifts.length} AI-curated picks for {occasion} · {recipient}</p>
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                          {gifts.map((gift) => (
                            <div key={gift.id} className="flex items-center gap-4 rounded-2xl border border-[#d4c5a9]/10 bg-[#2a2218] p-3">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                                <SmartImage src={gift.image_url} alt={gift.title} className="h-full w-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-[#e8dcc4]">{gift.title}</p>
                                {gift.aiReason && <p className="mt-0.5 text-xs text-[#d4a843]/80">✦ {gift.aiReason}</p>}
                                <p className="mt-1 text-sm font-semibold text-[#d4c5a9]">{fmt(gift.price_cents)}</p>
                              </div>
                              <button
                                onClick={() => { add(gift); toast(`${gift.title} added to cart`); }}
                                className="shrink-0 rounded-full bg-[#d4c5a9] px-3 py-1.5 text-xs font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4]"
                              >
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                        <button onClick={reset} className="mt-5 w-full rounded-full border border-[#d4c5a9]/15 py-2.5 text-sm text-[#d4c5a9]/60 transition hover:border-[#d4c5a9]/30 hover:text-[#d4c5a9]/90">
                          Start over
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
