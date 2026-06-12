import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type Product, type AppNotification, type CustomerProfile } from "../lib/api";
import { useCart } from "../store";
import { ReceiptModal } from "./ReceiptModal";

type Tab = "curated" | "orders" | "wishlist" | "notifications" | "profile" | "concierge";

export function CustomerPage() {
  const [tab, setTab] = useState<Tab>("curated");
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [curatedItems, setCuratedItems] = useState<Product[]>([]);
  const [showReceiptId, setShowReceiptId] = useState<string | null>(null);

  const { add } = useCart();

  const fmt = (cents: number) => `₹ ${(cents / 100).toLocaleString("en-IN")}`;

  useEffect(() => {
    if (tab === "orders") api.customer.orders().then(setOrders).catch(() => setOrders([]));
    if (tab === "wishlist") api.studio.wishlist().then(setWishlistItems).catch(() => setWishlistItems([]));
    if (tab === "notifications") api.studio.notifications().then(setNotifications).catch(() => setNotifications([]));
    if (tab === "curated") api.recommendations.get().then(setCuratedItems).catch(() => setCuratedItems([]));
  }, [tab]);

  const toggleOrder = (id: string) => {
    if (expandedOrder === id) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(id);
      if (!orderItems[id]) {
        api.orders.get(id).then(d => {
          setOrderItems(prev => ({ ...prev, [id]: d.items }));
        });
      }
    }
  };

  useEffect(() => {
    api.customer.profile().then(setProfile).catch(() => setProfile(null));
  }, []);

  const statusColor: Record<string, string> = {
    PENDING: "text-yellow-400", PAID: "text-green-400", FULFILLING: "text-blue-400",
    SHIPPED: "text-purple-400", DELIVERED: "text-emerald-400", CANCELLED: "text-red-400",
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "curated", label: "Curated For You", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg> },
    { id: "orders", label: "My Orders", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg> },
    { id: "wishlist", label: "Wishlist", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg> },
    { id: "notifications", label: "Alerts", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
    { id: "profile", label: "My Vault", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
    { id: "concierge", label: "Concierge", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" /></svg> },
  ];

  const getTier = (count: number) => {
    if (count >= 10) return { name: "Gold Patron", color: "text-[#d4a843]", border: "border-[#d4a843]/30", bg: "bg-[#d4a843]/10", glow: "shadow-[0_0_20px_rgba(212,168,67,0.2)]" };
    if (count >= 3) return { name: "Silver Collector", color: "text-slate-300", border: "border-slate-300/30", bg: "bg-slate-300/10", glow: "shadow-[0_0_20px_rgba(203,213,225,0.15)]" };
    return { name: "Bronze Enthusiast", color: "text-[#cd7f32]", border: "border-[#cd7f32]/30", bg: "bg-[#cd7f32]/10", glow: "shadow-[0_0_20px_rgba(205,127,50,0.15)]" };
  };

  const currentTier = getTier(profile?.orderCount || 0);

  return (
    <main className="text-white pt-6 pb-20">
      <section className="px-4 md:px-6">
        <div className="mx-auto max-w-[1400px]">
          
          {/* Hero Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0a0a0a] relative"
          >
            {/* Elegant Background Gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#d4c5a9]/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#d4a843]/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 px-8 py-10 sm:px-12 sm:py-16 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#d4c5a9]/50 mb-2">My Atelier</p>
                <h1 className="text-4xl sm:text-5xl font-serif text-[#e8dcc4] tracking-tight">
                  Welcome back, {profile?.name?.split(' ')[0] || "Collector"}.
                </h1>
                <p className="mt-3 text-[#d4c5a9]/60 max-w-xl text-sm leading-relaxed">
                  Your personal sanctuary of handcrafted luxury. Track your acquisitions, curate your wishlist, and manage your bespoke journey.
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full border ${currentTier.border} ${currentTier.bg} backdrop-blur-md ${currentTier.glow}`}>
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${currentTier.bg.replace('/10', '')}`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${currentTier.bg.replace('/10', '')}`}></span>
                  </span>
                  <span className={`text-sm font-semibold tracking-wide uppercase ${currentTier.color}`}>
                    {currentTier.name}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Dashboard Layout */}
          <div className="rounded-[2.5rem] border border-white/10 bg-[#0e0e0e] p-4 shadow-2xl md:p-6">
            <div className="grid gap-6 xl:grid-cols-[240px_1fr]">

            {/* Sidebar */}
            <aside className="space-y-4">
              <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-5 ml-2">My Portal</p>
                <div className="space-y-1.5">
                  {tabs.map((t) => {
                    const isActive = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`group relative flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-sm transition-all duration-300 overflow-hidden ${
                          isActive ? "bg-white/10 text-white font-medium" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        {isActive && (
                          <motion.div layoutId="activeTabIndicator" className="absolute left-0 top-0 w-1 h-full bg-[#d4c5a9] shadow-[0_0_10px_rgba(212,197,169,0.5)]" />
                        )}
                        <span className={`transition-colors duration-300 ${isActive ? "text-[#d4c5a9]" : "text-white/40 group-hover:text-white/60"}`}>
                          {t.icon}
                        </span>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Main content */}
            <div className="relative min-h-[500px]">
              <AnimatePresence mode="wait">

              {/* Curated For You */}
              {tab === "curated" && (
                <motion.div
                  key="curated"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-8 text-2xl font-serif text-[#e8dcc4] tracking-tight">Selected For Your Atelier</h2>
                  {curatedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-8 w-8 rounded-full border-2 border-[#d4c5a9] border-t-transparent animate-spin mb-4"></div>
                      <p className="text-white/40">Curating your exclusive selections...</p>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {curatedItems.map((p) => (
                        <div key={p.id} className="group overflow-hidden rounded-2xl border border-[#d4c5a9]/10 bg-black/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(212,197,169,0.1)] hover:border-[#d4c5a9]/40 hover:bg-black/80">
                          <div className="h-56 overflow-hidden bg-[#1a1510] relative">
                            {p.image_url && <img src={p.image_url} alt={p.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />}
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                              <p className="text-[10px] font-bold tracking-widest text-[#d4c5a9] uppercase">Exclusive</p>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-5">
                              <button onClick={() => add(p)} className="w-full rounded-xl bg-[#d4c5a9] px-4 py-2.5 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4] hover:scale-[1.02]">
                                Acquire Piece
                              </button>
                            </div>
                          </div>
                          <div className="p-5 relative">
                            <p className="font-serif text-lg text-white mb-1">{p.title}</p>
                            <p className="text-xs text-[#d4c5a9] tracking-wide uppercase">{p.artisan}</p>
                            <div className="mt-4 flex items-center justify-between">
                              <p className="font-medium text-white/80">{fmt(p.price_cents)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Orders */}
              {tab === "orders" && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-8 text-2xl font-serif text-[#e8dcc4] tracking-tight">My Orders</h2>
                  {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <svg className="w-24 h-24 text-white/5 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      <p className="text-white/40 mb-2">Your collection is waiting to begin.</p>
                      <a href="/#marketplace" className="text-sm font-medium text-[#d4c5a9] hover:text-[#e8dcc4] transition-colors">
                        Explore the Marketplace &rarr;
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((o) => {
                        const isExpanded = expandedOrder === o.id;
                        const items = orderItems[o.id];

                        return (
                          <div key={o.id} className="group overflow-hidden rounded-2xl bg-black/40 border border-white/5 transition-all duration-300 hover:shadow-xl hover:border-[#d4c5a9]/20">
                            <button 
                              onClick={() => toggleOrder(o.id)}
                              className="w-full flex items-center justify-between p-5 text-left bg-transparent transition-colors hover:bg-black/60"
                            >
                              <div>
                                <p className="font-mono text-sm font-semibold text-[#d4c5a9] tracking-wider flex items-center gap-2">
                                  #{o.id.slice(0, 8)}
                                  <svg className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                </p>
                                <p className="mt-1 text-xs text-white/40 flex items-center gap-2">
                                  <span>{new Date(o.created_at).toLocaleDateString()}</span>
                                  <span className="w-1 h-1 rounded-full bg-white/20" />
                                  <span>{o.item_count} item{o.item_count !== 1 ? "s" : ""}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-sm font-medium flex items-center justify-end gap-2 ${statusColor[o.status] ?? "text-white/60"}`}>
                                  {o.status === "DELIVERED" && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                                  {o.status === "SHIPPED" && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>}
                                  {o.status}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white tracking-wide">{fmt(o.total_cents)}</p>
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden border-t border-white/5 bg-black/60"
                                >
                                  <div className="p-5">
                                    {!items ? (
                                      <div className="flex justify-center py-4">
                                        <div className="h-4 w-4 rounded-full border-2 border-[#d4c5a9] border-t-transparent animate-spin"></div>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        {items.map(item => (
                                          <div key={item.id} className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#1a1510] flex-shrink-0">
                                              {item.product?.image_url && <img src={item.product.image_url} alt="Product" className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-white truncate">{item.product?.title || "Unknown Product"}</p>
                                              <p className="text-xs text-white/40">Qty: {item.quantity}</p>
                                            </div>
                                            <p className="text-sm text-[#d4c5a9] font-medium">{fmt(item.price_cents)}</p>
                                          </div>
                                        ))}
                                        <div className="pt-4 mt-2 border-t border-white/5 flex justify-end">
                                          <button 
                                            onClick={() => setShowReceiptId(o.id)}
                                            className="text-xs uppercase tracking-wider text-[#d4c5a9] font-medium hover:text-white transition flex items-center gap-1.5"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                            Download Receipt
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Wishlist */}
              {tab === "wishlist" && (
                <motion.div
                  key="wishlist"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-8 text-2xl font-serif text-[#e8dcc4] tracking-tight">Wishlist</h2>
                  {wishlistItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <svg className="w-24 h-24 text-white/5 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                      <p className="text-white/40 mb-2">Nothing saved yet.</p>
                      <a href="/#marketplace" className="text-sm font-medium text-[#d4c5a9] hover:text-[#e8dcc4] transition-colors">
                        Discover new pieces &rarr;
                      </a>
                    </div>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {wishlistItems.map((p) => (
                        <div key={p.id} className="group overflow-hidden rounded-2xl border border-white/5 bg-black/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#d4c5a9]/20 hover:bg-black/60">
                          <div className="h-48 overflow-hidden bg-[#1a1510] relative">
                            {p.image_url && <img src={p.image_url} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                          </div>
                          <div className="p-5">
                            <p className="font-medium text-white line-clamp-1">{p.title}</p>
                            <p className="mt-1 text-xs text-white/40 tracking-wide uppercase">{p.artisan}</p>
                            <div className="mt-4 flex items-center justify-between">
                              <p className="font-semibold text-[#d4c5a9]">{fmt(p.price_cents)}</p>
                              <button onClick={() => add(p)} className="rounded-full bg-[#d4c5a9] px-4 py-2 text-xs font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4]">
                                Add to cart
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Notifications */}
              {tab === "notifications" && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-8 text-2xl font-serif text-[#e8dcc4] tracking-tight">Notifications</h2>
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <svg className="w-24 h-24 text-white/5 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                      <p className="text-white/40">You're all caught up.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notifications.map((n) => (
                        <div key={n.id} className={`rounded-2xl p-5 transition-all ${n.read_at ? "bg-black/20 opacity-60" : "bg-black/40 border border-[#d4c5a9]/20 shadow-[0_0_15px_rgba(212,197,169,0.05)]"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-white">{n.title}</p>
                              <p className="mt-1.5 text-sm text-white/60 leading-relaxed">{n.body}</p>
                            </div>
                            {!n.read_at && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#d4c5a9] mt-2"></span>}
                          </div>
                          <p className="mt-4 text-xs text-white/30 tracking-wider uppercase">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Profile / Vault */}
              {tab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-8 text-2xl font-serif text-[#e8dcc4] tracking-tight">My Vault</h2>
                  {profile ? (
                    <div className="space-y-6">
                      
                      {/* Vault Analytics */}
                      <div className="rounded-2xl bg-gradient-to-br from-[#d4c5a9]/10 to-transparent border border-[#d4c5a9]/20 p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4c5a9]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <h3 className="mb-6 text-sm font-semibold tracking-wider text-[#d4c5a9] uppercase flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Lifetime Collection Value
                        </h3>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                          <div>
                            <p className="text-4xl font-serif text-white tracking-tight">{fmt(profile.lifetimeSpendCents)}</p>
                            <p className="mt-2 text-sm text-white/50">{profile.orderCount} acquired pieces in your collection</p>
                          </div>
                          <div className="w-full md:w-1/2">
                            <div className="flex justify-between text-xs text-white/40 mb-2 font-medium tracking-wide">
                              <span>{currentTier.name}</span>
                              <span>Next Tier</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <div className="h-full bg-gradient-to-r from-[#d4c5a9]/50 to-[#d4c5a9] rounded-full" style={{ width: `${Math.min(100, (profile.orderCount / (profile.orderCount < 3 ? 3 : 10)) * 100)}%` }}></div>
                            </div>
                            <p className="mt-2 text-[10px] text-right text-white/30 uppercase tracking-widest">
                              {profile.orderCount < 3 ? `${3 - profile.orderCount} more for Silver` : profile.orderCount < 10 ? `${10 - profile.orderCount} more for Gold` : "Max Tier Reached"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-black/40 border border-white/5 p-6">
                        <h3 className="mb-5 text-sm font-semibold tracking-wider text-[#d4c5a9] uppercase">Account Details</h3>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            api.customer.updateProfile({ name: fd.get("name") as string }).then(() => alert("Profile updated"));
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">Email</label>
                            <input type="text" value={profile.email} disabled className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white/50 outline-none cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">Name</label>
                            <input name="name" defaultValue={profile.name} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors" />
                          </div>
                          <button type="submit" className="rounded-xl bg-[#d4c5a9] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e8dcc4]">Save Name</button>
                        </form>
                      </div>

                      <div className="rounded-2xl bg-black/40 border border-white/5 p-6">
                        <h3 className="mb-5 text-sm font-semibold tracking-wider text-[#d4c5a9] uppercase">Saved Addresses</h3>
                        {profile.addresses.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center bg-black/20 rounded-xl border border-white/5 mb-6">
                             <p className="text-sm text-white/40">No addresses saved yet.</p>
                          </div>
                        ) : (
                          <div className="mb-8 grid gap-4 sm:grid-cols-2">
                            {profile.addresses.map((a) => (
                              <div key={a.id} className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 text-sm text-white/80 transition hover:border-white/20">
                                <p className="font-medium text-white mb-1">{a.line1}</p>
                                <p className="text-white/60">{a.city}, {a.postal}</p>
                                <p className="text-white/60 mt-2">{a.country}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <h4 className="mb-4 text-sm font-medium text-white/70">Add New Address</h4>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            api.customer.addAddress({
                              line1: fd.get("line1") as string,
                              city: fd.get("city") as string,
                              postal: fd.get("postal") as string,
                              country: fd.get("country") as string,
                            }).then(() => {
                              alert("Address added");
                              api.customer.profile().then(setProfile);
                            });
                            e.currentTarget.reset();
                          }}
                          className="grid gap-4 sm:grid-cols-2"
                        >
                          <input name="line1" required placeholder="Street Address" className="col-span-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors" />
                          <input name="city" required placeholder="City" className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors" />
                          <input name="postal" required placeholder="Postal Code" className="rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors" />
                          <input name="country" required placeholder="Country" className="col-span-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors" />
                          <div className="col-span-full mt-2">
                            <button type="submit" className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/20">Save Address</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-white/30 animate-pulse">Loading profile...</div>
                  )}
                </motion.div>
              )}

              {/* Concierge */}
              {tab === "concierge" && (
                <motion.div
                  key="concierge"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md"
                >
                  <h2 className="mb-2 text-2xl font-serif text-[#e8dcc4] tracking-tight">Personal Concierge</h2>
                  <p className="text-white/50 text-sm mb-8">Direct line to our bespoke luxury advisors.</p>
                  
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                      <div className="rounded-2xl bg-black/40 border border-white/5 p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#d4c5a9] to-transparent"></div>
                        <h3 className="font-medium text-white text-lg">Bespoke Inquiry</h3>
                        <p className="mt-2 text-sm text-white/60 leading-relaxed">
                          Whether you're looking for a specific artisanal piece, need assistance with a recent acquisition, or wish to commission a custom work, our advisors are at your service.
                        </p>
                        <div className="mt-6 space-y-4">
                          <div className="flex items-center gap-4 text-sm text-white/70">
                            <svg className="w-5 h-5 text-[#d4c5a9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                            concierge@atelier.luxury
                          </div>
                          <div className="flex items-center gap-4 text-sm text-white/70">
                            <svg className="w-5 h-5 text-[#d4c5a9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.864-1.051l-3.21-.535a2.25 2.25 0 00-2.25 1.052l-1.082 1.623a15.01 15.01 0 01-6.8-6.8l1.623-1.082a2.25 2.25 0 001.052-2.25l-.535-3.21C11.716 2.601 11.266 2.25 10.75 2.25H4.5a2.25 2.25 0 00-2.25 2.25z" /></svg>
                            +1 (800) 555-LUXE
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-[#0a0a0a] border border-[#d4c5a9]/20 p-8 shadow-[0_0_30px_rgba(212,197,169,0.03)]">
                      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); alert("Your inquiry has been sent to our concierge."); e.currentTarget.reset(); }}>
                        <div>
                          <label className="text-xs uppercase tracking-widest text-[#d4c5a9] mb-2 block">Subject</label>
                          <select className="w-full rounded-none border-b border-white/20 bg-transparent px-0 py-2.5 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors appearance-none">
                            <option className="bg-[#0a0a0a]">Order Inquiry</option>
                            <option className="bg-[#0a0a0a]">Custom Commission</option>
                            <option className="bg-[#0a0a0a]">Product Details</option>
                            <option className="bg-[#0a0a0a]">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest text-[#d4c5a9] mb-2 block">Your Message</label>
                          <textarea required rows={5} placeholder="How may we assist you today?" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#d4c5a9] transition-colors resize-none"></textarea>
                        </div>
                        <button type="submit" className="w-full rounded-xl bg-[#d4c5a9] px-6 py-3.5 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4] hover:shadow-[0_0_20px_rgba(212,197,169,0.3)]">
                          Send Inquiry
                        </button>
                      </form>
                    </div>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>
            </div>
          </div>
        </div>
      </section>

      {showReceiptId && (
        <ReceiptModal orderId={showReceiptId} onClose={() => setShowReceiptId(null)} />
      )}
    </main>
  );
}
