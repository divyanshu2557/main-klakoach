import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

type ReturnState = "idle" | "searching" | "found" | "error" | "requested";
type EligibilityData = { id: string; status: string; eligible: boolean; daysRemaining: number; orderDate: string };

export function ReturnsRefundsPage() {
  const [orderId, setOrderId] = useState("");
  const [state, setState] = useState<ReturnState>("idle");
  const [data, setData] = useState<EligibilityData | null>(null);
  const [requesting, setRequesting] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;

    setState("searching");
    try {
      // Small artificial delay for luxury feel
      await new Promise(r => setTimeout(r, 800));
      const res = await api.orders.checkReturn(orderId);
      setData(res);
      
      if (res.status === "RETURN_REQUESTED") {
         setState("requested");
      } else {
         setState("found");
      }
    } catch (err) {
      console.error(err);
      setState("error");
    }
  };

  const handleRequestPickup = async () => {
    if (!data) return;
    setRequesting(true);
    try {
      await new Promise(r => setTimeout(r, 800)); // luxury feel
      await api.orders.requestReturn(data.id);
      setData({ ...data, status: "RETURN_REQUESTED", eligible: false });
      setState("requested");
    } catch (err) {
      console.error(err);
      // fallback error handling
    } finally {
      setRequesting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f8f5ee] font-sans selection:bg-[#d4c5a9] selection:text-[#0a0a0a]">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Subtle Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1a1510_0%,transparent_70%)] opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#d4c5a9] rounded-full blur-[120px] opacity-[0.03] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d4c5a9] mb-4 block">Bespoke Logistics</span>
            <h1 className="font-serif text-5xl md:text-7xl tracking-[-0.02em] leading-tight text-transparent bg-clip-text bg-gradient-to-b from-[#f8f5ee] to-[#a39883]">
              Returns & Refunds
            </h1>
            <p className="mt-6 text-[#f8f5ee]/50 text-lg max-w-xl mx-auto leading-relaxed">
              We stand by the master craftsmanship of our artisans. If an acquisition does not meet your curation standards, our white-glove concierge is at your service.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="relative max-w-6xl mx-auto px-6 pb-32 grid gap-12 lg:grid-cols-12 items-start z-10">
        
        {/* Left Column: Policies */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-5 space-y-8"
        >
          <div className="bg-[#110e0b] border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-[#d4c5a9]/10 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-[#d4c5a9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-serif mb-3">30-Day Evaluation Window</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              You have 30 days from the date of acquisition to experience the piece in your space. Eligible returns must remain in pristine, unaltered condition with original hallmark tags.
            </p>
          </div>

          <div className="bg-[#110e0b] border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-[#d4c5a9]/10 flex items-center justify-center mb-6">
              <svg className="w-5 h-5 text-[#d4c5a9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
            </div>
            <h3 className="text-xl font-serif mb-3">Secure Repackaging</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              To honor the artisan's work, pieces must be secured in their custom-fitted wooden crates or original protective layers prior to our logistics team arriving for pickup.
            </p>
          </div>
        </motion.div>

        {/* Right Column: Interactive Checker */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="lg:col-span-7"
        >
          <div className="bg-gradient-to-b from-[#1a1510] to-[#0a0a0a] border border-[#d4c5a9]/20 rounded-[2rem] p-8 md:p-12 shadow-[0_0_50px_rgba(212,197,169,0.03)] relative overflow-hidden">
            {/* Subtle glow inside card */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4c5a9] rounded-full blur-[100px] opacity-[0.05] pointer-events-none" />

            <h2 className="text-2xl font-serif mb-2 relative z-10">Initiate a Return</h2>
            <p className="text-sm text-[#f8f5ee]/50 mb-10 relative z-10">Enter your secure Order Identifier to review eligibility.</p>

            <form onSubmit={handleCheck} className="relative z-10 mb-8">
              <div className="relative group">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. ba992f41-4a4d..."
                  className="w-full bg-black/40 border border-[#d4c5a9]/30 rounded-2xl px-6 py-5 text-[#f8f5ee] font-mono text-sm outline-none transition-all focus:border-[#d4c5a9] focus:bg-black/60 focus:ring-1 focus:ring-[#d4c5a9]/50 placeholder:text-white/20 uppercase"
                  required
                />
                <button
                  type="submit"
                  disabled={state === "searching" || !orderId}
                  className="absolute right-3 top-3 bottom-3 bg-[#d4c5a9] text-[#1a1510] rounded-xl px-6 font-semibold text-sm transition-all hover:bg-[#ebdaba] disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                >
                  {state === "searching" ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[#1a1510] border-t-transparent animate-spin"></div>
                  ) : (
                    "Verify"
                  )}
                </button>
              </div>
            </form>

            {/* Results Area */}
            <div className="relative">
              <AnimatePresence mode="wait">
                {state === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[160px] flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-2xl bg-white/5"
                  >
                    <svg className="w-8 h-8 text-white/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <p className="text-xs text-white/40 uppercase tracking-widest">Awaiting Verification</p>
                  </motion.div>
                )}

                {state === "error" && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex min-h-[160px] flex-col items-center justify-center text-center border border-red-900/30 rounded-2xl bg-red-900/10"
                  >
                    <svg className="w-8 h-8 text-red-500/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-sm text-red-400 font-medium">Record Not Found</p>
                    <p className="text-xs text-red-400/60 mt-1 max-w-[250px]">Ensure the identifier matches your official atelier receipt exactly.</p>
                  </motion.div>
                )}
                
                {state === "requested" && (
                  <motion.div
                    key="requested"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex min-h-[160px] flex-col items-center justify-center text-center border border-[#d4c5a9]/30 rounded-2xl bg-[#d4c5a9]/5 p-8"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#d4c5a9]/20 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-[#d4c5a9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h4 className="text-xl font-serif text-[#d4c5a9] mb-2">Concierge Dispatched</h4>
                    <p className="text-sm text-[#d4c5a9]/70 max-w-sm">
                      Your return request has been securely logged. Our white-glove logistics team will contact you shortly to schedule the pickup.
                    </p>
                  </motion.div>
                )}

                {state === "found" && data && (
                  <motion.div
                    key="found"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-6 rounded-2xl border ${data.eligible ? 'bg-[#d4c5a9]/5 border-[#d4c5a9]/20' : 'bg-white/5 border-white/10'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          {data.eligible ? (
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white/40">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </div>
                          )}
                          <h4 className="text-lg font-serif">
                            {data.eligible ? "Eligible for Return" : "Return Window Closed"}
                          </h4>
                        </div>
                        <p className="text-xs font-mono text-white/40 mt-3 uppercase tracking-widest">
                          Acquired {new Date(data.orderDate).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        {data.eligible ? (
                          <>
                            <p className="text-3xl font-serif text-[#d4c5a9]">{data.daysRemaining}</p>
                            <p className="text-xs uppercase tracking-widest text-[#d4c5a9]/50 mt-1">Days Left</p>
                          </>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium uppercase tracking-wider">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-white/10 flex justify-end gap-4">
                      {data.eligible ? (
                        <button 
                          onClick={handleRequestPickup}
                          disabled={requesting}
                          className="px-5 py-2.5 rounded-xl bg-[#d4c5a9] text-[#1a1510] text-xs font-semibold uppercase tracking-widest transition hover:bg-[#ebdaba] shadow-[0_0_15px_rgba(212,197,169,0.2)] disabled:opacity-50 flex items-center justify-center min-w-[200px]"
                        >
                          {requesting ? (
                            <div className="w-4 h-4 rounded-full border-2 border-[#1a1510] border-t-transparent animate-spin"></div>
                          ) : (
                            "Request Concierge Pickup"
                          )}
                        </button>
                      ) : (
                        <button className="px-5 py-2.5 rounded-xl border border-white/20 text-white/60 text-xs font-semibold uppercase tracking-widest transition hover:bg-white/10 hover:text-white">
                          Contact Support
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
