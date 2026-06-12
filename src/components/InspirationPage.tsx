import { useState } from "react";
import { motion } from "framer-motion";
import { inspirations, spaces } from "../data";
import { SmartImage } from "./SmartImage";

const moodBoards = [
  { title: "Japandi Minimalism", tag: "Living Room", image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=85", span: "lg:col-span-2 lg:row-span-2" },
  { title: "Earthy Tones", tag: "Bedroom", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=85", span: "" },
  { title: "Artisan Kitchen", tag: "Dining", image: "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=85", span: "" },
  { title: "Wabi-Sabi Entry", tag: "Entryway", image: "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=800&q=85", span: "" },
  { title: "Garden Sanctuary", tag: "Outdoor", image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=800&q=85", span: "" },
  { title: "Creative Workspace", tag: "Office", image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=85", span: "" },
];

const tags = ["All", "Living Room", "Bedroom", "Dining", "Entryway", "Outdoor", "Office"];

export function InspirationPage() {
  const [tag, setTag] = useState("All");

  const filtered = moodBoards.filter((m) => tag === "All" || m.tag === tag);

  return (
    <div className="min-h-screen bg-[#f5efe6]">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden md:h-[460px]">
        <img
          src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=2400&q=85"
          alt="Inspiration"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/40 via-transparent to-[#f5efe6]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/80 mb-4">
            get inspired
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-serif text-4xl md:text-6xl text-[#e8dcc4] tracking-[-0.03em]">
            Spaces that breathe.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 text-[#d4c5a9]/70 max-w-md">
            Mood boards, room ideas, and styling guides curated by our design team.
          </motion.p>
        </div>
      </div>

      {/* Filter */}
      <div className="sticky top-[57px] z-30 border-b border-[#d4c5a9]/20 bg-[#f5efe6]/95 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-7xl flex gap-2 overflow-x-auto pb-1">
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                tag === t ? "bg-[#1a1510] text-[#e8dcc4]" : "border border-[#1a1510]/15 text-[#8a7d6b] hover:border-[#1a1510]/30 hover:text-[#1a1510]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Masonry-style grid */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {filtered.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className={`group relative overflow-hidden rounded-2xl cursor-pointer ${m.span} ${i === 0 ? "h-80 lg:h-full" : "h-64"}`}
            >
              <SmartImage src={m.image} alt={m.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510]/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-white backdrop-blur-md mb-2">
                  {m.tag}
                </span>
                <p className="font-medium text-[#e8dcc4]">{m.title}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Shop by space */}
        <div className="mt-20">
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Shop by Space</p>
          <h2 className="mb-10 font-serif text-4xl text-[#1a1510]">Find pieces for every room.</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {spaces.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group cursor-pointer"
              >
                <div className="relative h-48 overflow-hidden rounded-2xl">
                  <SmartImage src={s.image} alt={s.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510]/60 to-transparent" />
                  <p className="absolute bottom-3 left-3 text-sm font-medium text-white">{s.name}</p>
                </div>
                <p className="mt-2 text-xs text-[#8a7d6b]">{s.count}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Inspiration gallery */}
        <div className="mt-20">
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Community Picks</p>
          <h2 className="mb-10 font-serif text-4xl text-[#1a1510]">Styled by our community.</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {inspirations.map((insp, i) => (
              <motion.div
                key={insp.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group relative h-64 overflow-hidden rounded-2xl cursor-pointer"
              >
                <SmartImage src={insp.image} alt={insp.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510]/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-md">
                    <span>klakoach</span>
                    <span className="text-white/40">•</span>
                    <span>{insp.title}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


