import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { api } from "../lib/api";

import { ReceiptModal } from "./ReceiptModal";

type TrackingState = "idle" | "searching" | "found" | "error";
type OrderData = { id: string; status: string; created_at: string; tracking_number?: string; carrier?: string };

function generateMilestones(order: OrderData | null) {
  if (!order) return [];
  
  const timelineMap: Record<string, number> = {
    "PENDING": 0,
    "PAID": 1,
    "FULFILLING": 2,
    "SHIPPED": 3,
    "DELIVERED": 4,
  };
  
  const currentIndex = timelineMap[order.status] ?? -1;
  const isCancelled = order.status === "CANCELLED" || order.status === "REFUNDED";

  const getStatus = (stepIndex: number) => {
    if (isCancelled) return "pending"; // We can handle cancelled specifically, but keep it simple
    if (currentIndex > stepIndex) return "completed";
    if (currentIndex === stepIndex) return "active";
    return "pending";
  };

  const milestones = [
    {
      id: "placed",
      title: "Order Placed",
      description: "Your acquisition request has been securely received.",
      date: new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: getStatus(0),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "crafting",
      title: "Artisan Crafting",
      description: "The piece is currently being refined in the artisan's studio.",
      date: currentIndex >= 1 ? "Processing" : "Pending",
      status: getStatus(1),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
    {
      id: "quality",
      title: "Authenticity Verification",
      description: "Rigorous quality inspection and hallmark stamping.",
      date: currentIndex >= 2 ? "Checking" : "Pending",
      status: getStatus(2),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      id: "transit",
      title: "White-Glove Transit",
      description: order.carrier ? `Shipped via ${order.carrier} (Tracking: ${order.tracking_number})` : "Handed over to our premium logistics partner.",
      date: currentIndex >= 3 ? "In Transit" : "Pending",
      status: getStatus(3),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      ),
    },
    {
      id: "delivered",
      title: "Delivered",
      description: "Safely arrived at your atelier.",
      date: currentIndex === 4 ? "Completed" : "Pending",
      status: currentIndex === 4 ? "completed" : "pending",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
  ];
  
  if (isCancelled) {
    milestones.push({
      id: "cancelled",
      title: order.status === "REFUNDED" ? "Refunded" : "Cancelled",
      description: "The order has been cancelled.",
      date: "",
      status: "active",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    });
  }

  return milestones;
}

export function TrackOrderPage() {
  const [trackingId, setTrackingId] = useState("");
  const [state, setState] = useState<TrackingState>("idle");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setState("searching");

    try {
      const res = await api.orders.track(trackingId.trim());
      setOrder(res);
      setState("found");
    } catch (err) {
      console.error(err);
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#d4c5a9] selection:text-[#1a1510] relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#d4c5a9]/5 to-transparent rounded-full blur-[120px] -mr-[200px] -mt-[200px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#1a1510]/80 to-transparent rounded-full blur-[100px] -ml-[100px] -mb-[100px] pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 sm:py-32">
        <div className="text-center mb-16">
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-[#d4c5a9] mb-4"
          >
            Concierge Logistics
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif text-5xl md:text-7xl tracking-[-0.02em] text-[#f3ead8]"
          >
            Track Your Acquisition
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-lg text-white/50 max-w-xl mx-auto font-light leading-relaxed"
          >
            Enter your secure tracking cipher to follow your piece's journey from the artisan's studio to your atelier.
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          {/* Tracking Input Form */}
          <form 
            onSubmit={handleTrack} 
            className="relative flex items-center group bg-[#1a1510]/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-2 transition-all duration-500 focus-within:border-[#d4c5a9]/40 focus-within:bg-[#1a1510]/80 focus-within:shadow-[0_0_40px_rgba(212,197,169,0.05)]"
          >
            <div className="pl-6 pr-2 text-[#d4c5a9]/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input 
              type="text" 
              value={trackingId}
              onChange={(e) => {
                setTrackingId(e.target.value);
                if (state === "found") setState("idle");
              }}
              placeholder="E.g. KLA-9284-XYZ"
              className="w-full bg-transparent border-none outline-none text-white placeholder:text-white/20 font-mono tracking-widest text-sm px-4 py-4"
              disabled={state === "searching"}
            />
            <button 
              type="submit"
              disabled={state === "searching" || !trackingId.trim()}
              className="shrink-0 bg-[#d4c5a9] text-[#0a0a0a] px-8 py-4 rounded-[1.5rem] text-sm font-semibold tracking-wide transition-all hover:bg-[#f3ead8] hover:shadow-[0_0_20px_rgba(212,197,169,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state === "searching" ? "Locating..." : "Track"}
            </button>

            {/* Progress Bar for Searching (Indeterminate) */}
            <AnimatePresence>
              {state === "searching" && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -bottom-1 left-4 right-4 h-[2px] bg-white/5 overflow-hidden rounded-full"
                >
                  <motion.div 
                    className="h-full bg-gradient-to-r from-transparent via-[#d4c5a9] to-[#d4c5a9]"
                    initial={{ left: "-100%", width: "50%" }}
                    animate={{ left: "150%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    style={{ position: "relative" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Timeline View */}
          <AnimatePresence mode="wait">
            {state === "found" && (
              <motion.div 
                key="timeline"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mt-16 bg-[#120f0c] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
              >
                {/* Decorative map/grid lines in background */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#d4c5a9 1px, transparent 1px)", backgroundSize: "32px 32px" }}></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-12 pb-8 border-b border-white/10 gap-6">
                  <div>
                    <p className="text-xs font-mono text-[#d4c5a9]/60 tracking-widest uppercase mb-2">Shipment ID</p>
                    <p className="text-2xl font-mono text-white tracking-wider">{trackingId.toUpperCase()}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-xs font-mono text-[#d4c5a9]/60 tracking-widest uppercase mb-2">Expected Arrival</p>
                    <p className="text-2xl font-serif text-[#d4c5a9]">{order ? new Date(new Date(order.created_at).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString() : "Pending"}</p>
                  </div>
                </div>

                <div className="relative z-10">
                  {generateMilestones(order).map((milestone, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const isActive = milestone.status === "active";
                    const isCompleted = milestone.status === "completed";
                    const isPending = milestone.status === "pending";

                    return (
                      <div key={milestone.id} className="relative flex gap-8 pb-12 last:pb-0 group">
                        {/* Connecting Line */}
                        {!isLast && (
                          <div className="absolute left-6 top-14 bottom-0 w-[2px] -ml-[1px]">
                            <div className="w-full h-full bg-white/5 absolute top-0" />
                            {(isCompleted || isActive) && (
                              <motion.div 
                                initial={{ height: 0 }}
                                animate={{ height: "100%" }}
                                transition={{ duration: 1, delay: 0.5 + (idx * 0.2) }}
                                className={`absolute top-0 w-full ${isActive ? "bg-gradient-to-b from-[#d4c5a9] to-transparent" : "bg-[#d4c5a9]"}`}
                              />
                            )}
                          </div>
                        )}

                        {/* Icon Node */}
                        <div className="relative z-10 shrink-0">
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 + (idx * 0.1), type: "spring" }}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                              isCompleted ? "bg-[#d4c5a9] border-[#d4c5a9] text-[#0a0a0a]" :
                              isActive ? "bg-[#1a1510] border-[#d4c5a9] text-[#d4c5a9] shadow-[0_0_20px_rgba(212,197,169,0.2)]" :
                              "bg-[#0a0a0a] border-white/10 text-white/20"
                            }`}
                          >
                            {milestone.icon}
                            {isActive && (
                              <div className="absolute inset-0 rounded-full border-2 border-[#d4c5a9] animate-ping opacity-20"></div>
                            )}
                          </motion.div>
                        </div>

                        {/* Content */}
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + (idx * 0.1) }}
                          className={`flex-1 pt-2 ${isPending ? "opacity-40" : "opacity-100"}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <h3 className={`text-lg font-medium tracking-wide ${isActive ? "text-[#d4c5a9]" : "text-white"}`}>
                              {milestone.title}
                            </h3>
                            <span className="text-xs font-mono tracking-widest text-white/40 uppercase">
                              {milestone.date}
                            </span>
                          </div>
                          <p className="text-sm text-white/50 leading-relaxed max-w-md">
                            {milestone.description}
                          </p>
                          
                          {isActive && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ delay: 0.8 }}
                              className="mt-6 p-4 rounded-xl bg-[#d4c5a9]/5 border border-[#d4c5a9]/20 flex items-start gap-4"
                            >
                              <div className="w-2 h-2 mt-1.5 rounded-full bg-[#d4c5a9] animate-pulse shrink-0" />
                              <p className="text-xs text-[#d4c5a9]/80 leading-relaxed font-medium">
                                The Master Artisan is finalizing the glazing process. Estimated completion in 48 hours before handover to our logistics concierges.
                              </p>
                            </motion.div>
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Actions */}
                <div className="mt-12 pt-8 border-t border-white/10 flex justify-end gap-4 relative z-10">
                   <button 
                     onClick={() => setShowReceipt(true)}
                     className="px-6 py-3 rounded-xl border border-white/10 text-xs font-semibold uppercase tracking-widest text-white/60 hover:text-white hover:border-white/30 transition-colors"
                   >
                     View Receipt
                   </button>
                   <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-semibold uppercase tracking-widest text-[#d4c5a9] hover:bg-white/10 transition-colors">
                     Contact Support
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {showReceipt && order && (
        <ReceiptModal orderId={order.id} onClose={() => setShowReceipt(false)} />
      )}
    </main>
  );
}
