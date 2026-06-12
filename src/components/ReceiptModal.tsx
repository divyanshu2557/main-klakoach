import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

type ReceiptData = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  items: { quantity: number; price_cents: number; title: string }[];
};

export function ReceiptModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.orders.getReceipt(orderId)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  const fmt = (cents: number) => `₹${(cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-[#faf8f5] text-[#1a1510] rounded-[2rem] shadow-2xl overflow-hidden print:w-full print:max-w-none print:max-h-none print:shadow-none print:bg-white print:rounded-none"
        >
          {loading ? (
            <div className="p-16 flex justify-center items-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#1a1510] border-t-transparent animate-spin"></div>
            </div>
          ) : !data ? (
            <div className="p-16 text-center text-red-800">
              <p>Unable to retrieve receipt. Please try again later.</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-[#1a1510] text-white rounded-full">Close</button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto p-10 md:p-14 print:p-8 print:overflow-visible">
                {/* Header */}
                <div className="flex justify-between items-start mb-12 pb-8 border-b border-[#1a1510]/10 print:mb-8 print:pb-6">
                  <div>
                    <h2 className="text-3xl font-serif tracking-tight text-[#1a1510]">Klakoach</h2>
                    <p className="text-xs uppercase tracking-widest text-[#1a1510]/50 mt-2">Atelier & Logistics</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-semibold uppercase tracking-widest">Official Receipt</h3>
                    <p className="text-sm font-mono text-[#1a1510]/70 mt-1">{new Date(data.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="mb-10 print:mb-8">
                  <p className="text-xs font-mono text-[#1a1510]/50 uppercase tracking-widest mb-2">Order Identifier</p>
                  <p className="text-sm font-mono">{data.id.toUpperCase()}</p>
                </div>

                {/* Items */}
                <div className="space-y-6 mb-12 print:mb-8">
                  {data.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start group">
                      <div className="flex-1 pr-6">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-[#1a1510]/50 mt-1">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{fmt(item.price_cents * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-[#1a1510]/10 pt-6 flex justify-between items-center print:pt-4">
                  <p className="text-sm uppercase tracking-widest text-[#1a1510]/60">Total Amount</p>
                  <p className="text-2xl font-serif">{fmt(data.total_cents)}</p>
                </div>
              </div>

              {/* Actions (Hidden on Print) */}
              <div className="bg-[#1a1510] text-[#faf8f5] p-6 flex justify-end gap-4 print:hidden">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full border border-white/20 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="px-6 py-2.5 rounded-full bg-[#d4c5a9] text-[#1a1510] text-sm font-semibold hover:bg-[#ebdaba] transition-colors shadow-[0_0_15px_rgba(212,197,169,0.3)] flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print / Save PDF
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
