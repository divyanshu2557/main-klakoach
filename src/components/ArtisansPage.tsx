import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, type HomeFeed } from "../lib/api";
import { SmartImage } from "./SmartImage";
import { artisans as fallbackArtisans } from "../data";

const extendedArtisans = [
  ...fallbackArtisans,
  { name: "Priya Reddy", craft: "Macramé & Fiber", followers: "7.1K", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80" },
  { name: "Rohan Mehta", craft: "Woodturning", followers: "5.8K", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80" },
  { name: "Leila Nasser", craft: "Indigo Dyeing", followers: "11.2K", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80" },
  { name: "Arjun Das", craft: "Stone Carving", followers: "4.4K", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80" },
];

const crafts = ["All", "Ceramics", "Textiles", "Woodwork", "Brass & Metal", "Macramé & Fiber", "Indigo Dyeing", "Stone Carving", "Woodturning"];



export function ArtisansPage() {
  const [filter, setFilter] = useState("All");
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [home, setHome] = useState<HomeFeed | null>(null);

  useEffect(() => {
    api.content.home().then(setHome).catch(() => setHome(null));
  }, []);

  const artisanRows = home?.artisans ?? extendedArtisans;
  const filtered = artisanRows.filter((a) => filter === "All" || a.craft === filter);
  const featuredWork = home?.recommendations ?? featuredWorkFallback;

  return (
    <div className="min-h-screen bg-[#1a1510]">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden md:h-[440px]">
        <img
          src="https://images.unsplash.com/photo-1595351298020-038700609878?auto=format&fit=crop&w=2400&q=85"
          alt="Artisans"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/70 via-[#1a1510]/40 to-[#1a1510]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/60 mb-4">
            artisan spotlight
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-serif text-4xl md:text-6xl text-[#e8dcc4] tracking-[-0.03em]">
            The hands behind the craft.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 text-[#d4c5a9]/50 max-w-md">
            {artisanRows.length} verified artisans. Each one a master of their medium.
          </motion.p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-[57px] z-30 border-b border-[#d4c5a9]/10 bg-[#1a1510]/95 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex gap-2 overflow-x-auto pb-1">
          {crafts.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === c ? "bg-[#d4c5a9] text-[#1a1510]" : "border border-[#d4c5a9]/20 text-[#d4c5a9]/60 hover:border-[#d4c5a9]/40 hover:text-[#d4c5a9]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Artisan grid */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((a, i) => (
            <motion.div
              key={a.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group rounded-3xl border border-[#d4c5a9]/10 bg-[#2a2218] p-6 text-center transition hover:border-[#d4c5a9]/25"
            >
              <div className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-full border-2 border-[#d4c5a9]/20">
                <SmartImage src={a.image} alt={a.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <p className="font-medium text-[#e8dcc4]">{a.name}</p>
              <p className="mt-1 text-sm text-[#d4c5a9]/50">{a.craft}</p>
              <p className="mt-2 text-xs text-[#d4c5a9]/35">{a.followers} Followers</p>
              <button
                onClick={() => {
                  const s = new Set(followed);
                  s.has(a.name) ? s.delete(a.name) : s.add(a.name);
                  setFollowed(s);
                }}
                className={`mt-5 w-full rounded-full py-2.5 text-sm font-medium transition ${
                  followed.has(a.name)
                    ? "bg-[#d4c5a9] text-[#1a1510]"
                    : "border border-[#d4c5a9]/25 text-[#d4c5a9]/70 hover:border-[#d4c5a9]/50 hover:text-[#e8dcc4]"
                }`}
              >
                {followed.has(a.name) ? "Following ✓" : "Follow"}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Featured work */}
        <div className="mt-24">
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/40">Featured Work</p>
          <h2 className="mb-10 font-serif text-4xl text-[#e8dcc4]">Latest from the studios.</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {featuredWork.map((w, i) => (
              <motion.div
                key={w.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group relative h-80 overflow-hidden rounded-2xl cursor-pointer"
              >
                <SmartImage src={w.image} alt={w.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510]/80 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-xs text-[#d4c5a9]/60 mb-1">{w.artisan}</p>
                  <p className="font-medium text-[#e8dcc4]">{w.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Apply CTA */}
        <div className="mt-20 rounded-3xl border border-[#d4c5a9]/10 bg-[#2a2218] p-10 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/40 mb-4">Join the community</p>
          <h3 className="font-serif text-3xl text-[#e8dcc4] mb-4">Are you a maker?</h3>
          <p className="text-[#d4c5a9]/50 max-w-md mx-auto mb-8">Apply to become a verified klakoach artisan and reach collectors across 25+ countries.</p>
          <button className="rounded-full bg-[#d4c5a9] px-8 py-4 text-sm font-semibold text-[#1a1510] hover:bg-[#e8dcc4]">
            Apply to sell →
          </button>
        </div>
      </div>
    </div>
  );
}

const featuredWorkFallback = [
  { artisan: "Meera Vaidya", name: "Raku Series No. 7", image: "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=800&q=80" },
  { artisan: "Ananya Sen", name: "Loom Stories III", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80" },
  { artisan: "Kabeer Malhotra", name: "Solstice Bowl", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80" },
];


