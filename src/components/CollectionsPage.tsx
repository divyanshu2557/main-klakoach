import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "../store";
import { api, type HomeFeed } from "../lib/api";
import { SmartImage } from "./SmartImage";
import { collections as fallbackCollections, recommendations as fallbackRecommendations, trending as fallbackTrending } from "../data";

const extendedCollections = [
  ...fallbackCollections,
  { title: "Wabi-Sabi Living", count: "890 Products", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80" },
  { title: "Artisan Metals", count: "640 Products", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80" },
  { title: "Handwoven World", count: "1,120 Products", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=800&q=80" },
  { title: "Organic Forms", count: "780 Products", image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80" },
];

const fallbackProducts = [...fallbackRecommendations, ...fallbackTrending.map((t) => ({ ...t, artisan: "klakoach Studio", price: t.price }))];

export function CollectionsPage() {
  const [active, setActive] = useState<string | null>(null);
  const [home, setHome] = useState<HomeFeed | null>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  useEffect(() => {
    api.content.home().then(setHome).catch(() => setHome(null));
  }, []);

  useEffect(() => {
    if (active) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [active]);

  const collectionRows = home?.collections ?? extendedCollections;
  const allProducts = home?.recommendations ?? fallbackProducts;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden md:h-[420px]">
        <img
          src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=2400&q=85"
          alt="Collections"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#1a1510]/50 via-[#1a1510]/30 to-[#faf8f5]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/70 mb-4">
            curated collections
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-serif text-4xl md:text-6xl text-[#e8dcc4] tracking-[-0.03em]">
            Worlds within worlds.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 text-[#d4c5a9]/60 max-w-md">
            Each collection is a carefully curated universe of craft, material, and meaning.
          </motion.p>
        </div>
      </div>

      {/* Collections grid */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {collectionRows.map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              onClick={() => setActive(active === col.title ? null : col.title)}
              className="group cursor-pointer"
            >
              <div className="relative h-80 overflow-hidden rounded-2xl bg-[#1a1510]">
                <SmartImage src={col.image} alt={col.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-[#1a1510] via-[#1a1510]/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="font-medium text-[#e8dcc4]">{col.title}</p>
                  <p className="mt-1 text-sm text-[#d4c5a9]/50">{col.count}</p>
                  <div className={`mt-3 flex items-center gap-1 text-xs text-[#d4a843] transition-all duration-300 ${active === col.title ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <span>Explore</span>
                    <span>→</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Expanded collection products */}
        <AnimatePresence>
          {active && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-12 border-t border-[#d4c5a9]/20 pt-12" ref={expandedRef}>
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="font-serif text-3xl text-[#1a1510]">{active}</h2>
                  <button onClick={() => setActive(null)} className="text-sm text-[#8a7d6b] hover:text-[#1a1510]">Close ✕</button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {allProducts.slice(0, 4).map((p, i) => (
                    <motion.div key={p.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="group cursor-pointer" onClick={() => navigate("marketplace")}>
                      <div className="h-64 overflow-hidden rounded-2xl bg-[#e8e0d5]">
                        <SmartImage src={p.image} alt={p.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                      </div>
                      <p className="mt-3 font-medium text-[#1a1510]">{p.name}</p>
                      <p className="text-sm text-[#8a7d6b]">{p.artisan}</p>
                      <p className="mt-1 font-semibold text-[#1a1510]">{p.price}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Featured banner */}
        <div className="mt-20 overflow-hidden rounded-3xl">
          <div className="relative h-64 md:h-80">
            <img
              src="https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&w=2000&q=85"
              alt="New season"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-r from-[#1a1510]/80 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center px-10">
              <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/60 mb-3">New Season</p>
              <h3 className="font-serif text-3xl md:text-5xl text-[#e8dcc4] max-w-sm">The Autumn Edit has arrived.</h3>
              <button className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[#d4c5a9] px-6 py-3 text-sm font-semibold text-[#1a1510] hover:bg-[#e8dcc4]">
                Discover now →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


