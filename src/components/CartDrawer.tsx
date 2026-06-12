import { motion, AnimatePresence } from "framer-motion";
import { useCart, useSession } from "../store";
import { api } from "../lib/api";
import { useState } from "react";
import { SmartImage } from "./SmartImage";

export function CartDrawer() {
  const { items, open, setOpen, remove, update, clear, total } = useCart();
  const { token } = useSession();
  const [checking, setChecking] = useState(false);
  const [orderDone, setOrderDone] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  const fmt = (cents: number) => `₹ ${(cents / 100).toLocaleString("en-IN")}`;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    if (!token) { alert("Please sign in to checkout"); return; }
    setChecking(true);
    try {
      const payload = items.map((ci) => ({ productId: ci.product.id, quantity: ci.quantity }));
      const result = await api.payments.checkout({ items: payload, couponCode: couponCode || undefined });
      
      const res = await loadRazorpayScript();
      if (!res) {
        alert("Razorpay SDK failed to load. Are you offline?");
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_placeholder", 
        amount: result.amountCents,
        currency: "INR",
        name: "Klakoach",
        description: "Handcrafted Luxury",
        order_id: result.clientSecret, // this is the razorpay order_id
        handler: function () {
          // Success!
          setOrderDone(result.orderId);
          clear();
          setCouponCode("");
        },
        theme: {
          color: "#d4c5a9"
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert("Payment failed: " + response.error.description);
      });
      rzp.open();

    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-[90] flex h-full w-full max-w-md flex-col bg-[#1a1510] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#d4c5a9]/10 px-6 py-5">
              <div>
                <h2 className="font-serif text-2xl text-[#e8dcc4]">Your Cart</h2>
                <p className="text-sm text-[#d4c5a9]/50">{items.length} item{items.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border border-[#d4c5a9]/15 text-[#d4c5a9]/60 hover:border-[#d4c5a9]/30">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {orderDone ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="text-4xl">✦</div>
                  <p className="font-serif text-2xl text-[#e8dcc4]">Order placed!</p>
                  <p className="text-sm text-[#d4c5a9]/50">Order #{orderDone.slice(0, 8)}</p>
                  <button onClick={() => { setOrderDone(null); setOpen(false); }} className="mt-4 rounded-full bg-[#d4c5a9] px-6 py-3 text-sm font-semibold text-[#1a1510]">
                    Continue shopping
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-4xl text-[#d4c5a9]/20">◎</p>
                  <p className="text-[#d4c5a9]/50">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((ci) => (
                    <div key={ci.product.id} className="flex gap-4 rounded-2xl border border-[#d4c5a9]/10 bg-[#2a2218] p-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#332b1f]">
                        <SmartImage src={ci.product.image_url} alt={ci.product.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#e8dcc4]">{ci.product.title}</p>
                          <p className="text-xs text-[#d4c5a9]/40">{ci.product.artisan}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 rounded-full border border-[#d4c5a9]/15 px-3 py-1">
                            <button onClick={() => update(ci.product.id, ci.quantity - 1)} className="text-[#d4c5a9]/60 hover:text-[#e8dcc4]">−</button>
                            <span className="w-5 text-center text-sm text-[#e8dcc4]">{ci.quantity}</span>
                            <button onClick={() => update(ci.product.id, ci.quantity + 1)} className="text-[#d4c5a9]/60 hover:text-[#e8dcc4]">+</button>
                          </div>
                          <p className="text-sm font-semibold text-[#e8dcc4]">{fmt(ci.product.price_cents * ci.quantity)}</p>
                        </div>
                      </div>
                      <button onClick={() => remove(ci.product.id)} className="self-start text-[#d4c5a9]/30 hover:text-red-400">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && !orderDone && (
              <div className="border-t border-[#d4c5a9]/10 px-6 py-5">
                <div className="mb-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-lg border border-[#d4c5a9]/15 bg-[#2a2218] px-3 py-2 text-sm text-[#e8dcc4] outline-none transition focus:border-[#d4a843]/40"
                  />
                  <button className="rounded-lg bg-[#d4c5a9]/10 px-4 py-2 text-sm font-semibold text-[#d4a843] transition hover:bg-[#d4a843]/20">
                    Apply
                  </button>
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[#d4c5a9]/60">Total</span>
                  <span className="font-serif text-2xl text-[#e8dcc4]">{fmt(total())}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checking}
                  className="w-full rounded-full bg-[#d4c5a9] py-4 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4] disabled:opacity-50"
                >
                  {checking ? "Processing…" : "Checkout →"}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
