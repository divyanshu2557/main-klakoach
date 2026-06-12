import { useState } from "react";
import { motion } from "framer-motion";
import { SmartImage } from "./SmartImage";

const articles = [
  {
    id: 1, category: "Craft", readTime: "6 min",
    title: "The ancient art of Raku firing and why it's having a modern renaissance",
    excerpt: "From 16th-century Kyoto tea ceremonies to contemporary studios in Berlin and Mumbai — Raku's unpredictable beauty is captivating a new generation.",
    image: "https://images.unsplash.com/photo-1565193298357-1765689f2fba?auto=format&fit=crop&w=1200&q=85",
    author: "Meera Vaidya", authorImage: "https://images.unsplash.com/photo-1595351298020-038700609878?auto=format&fit=crop&w=100&q=80",
    date: "Dec 12, 2024", featured: true,
  },
  {
    id: 2, category: "Design", readTime: "4 min",
    title: "Wabi-Sabi: the Japanese philosophy that makes imperfection beautiful",
    excerpt: "How embracing cracks, asymmetry, and the passage of time can transform the way you see your home.",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=85",
    author: "Ishaan Rao", authorImage: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0ff?auto=format&fit=crop&w=100&q=80",
    date: "Dec 8, 2024", featured: false,
  },
  {
    id: 3, category: "Sustainability", readTime: "5 min",
    title: "Why natural dyes are making a comeback in Indian textile traditions",
    excerpt: "Indigo, turmeric, pomegranate rind — artisans across Rajasthan are reviving plant-based dyeing with stunning results.",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=85",
    author: "Ananya Sen", authorImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    date: "Dec 3, 2024", featured: false,
  },
  {
    id: 4, category: "Artisan Stories", readTime: "7 min",
    title: "Kabeer Malhotra: forging brass in the old city of Moradabad",
    excerpt: "Three generations of metalwork, one family's mission to keep the craft alive in the age of mass production.",
    image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=85",
    author: "klakoach Editorial", authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    date: "Nov 28, 2024", featured: false,
  },
  {
    id: 5, category: "Design", readTime: "3 min",
    title: "How to style a handcrafted object in a modern interior",
    excerpt: "The art of mixing the handmade with the contemporary — without it looking like a craft fair.",
    image: "https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=800&q=85",
    author: "klakoach Editorial", authorImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    date: "Nov 20, 2024", featured: false,
  },
  {
    id: 6, category: "Craft", readTime: "5 min",
    title: "The meditative practice of hand-weaving on a floor loom",
    excerpt: "Slow, rhythmic, and deeply intentional — why more people are learning to weave in a world that moves too fast.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=800&q=85",
    author: "Ananya Sen", authorImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    date: "Nov 14, 2024", featured: false,
  },
];

const cats = ["All", "Craft", "Design", "Sustainability", "Artisan Stories"];

export function JournalPage() {
  const [cat, setCat] = useState("All");
  const featured = articles.find((a) => a.featured)!;
  const rest = articles.filter((a) => !a.featured && (cat === "All" || a.category === cat));

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden md:h-[420px]">
        <img
          src="https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&w=2400&q=85"
          alt="Journal"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/60 via-[#1a1510]/30 to-[#faf8f5]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/70 mb-4">
            the klakoach journal
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-serif text-4xl md:text-6xl text-[#e8dcc4] tracking-[-0.03em]">
            Stories of craft & culture.
          </motion.h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Featured article */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="group mb-16 grid gap-8 overflow-hidden rounded-3xl border border-[#d4c5a9]/20 bg-white lg:grid-cols-2 cursor-pointer hover:shadow-xl transition-shadow duration-500"
        >
          <div className="h-72 overflow-hidden lg:h-auto">
            <SmartImage src={featured.image} alt={featured.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          </div>
          <div className="flex flex-col justify-center p-8 lg:p-10">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-[#1a1510] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#d4c5a9]">{featured.category}</span>
              <span className="text-xs text-[#8a7d6b]">{featured.readTime} read</span>
            </div>
            <h2 className="font-serif text-3xl leading-tight text-[#1a1510] md:text-4xl">{featured.title}</h2>
            <p className="mt-4 text-[#8a7d6b] leading-7">{featured.excerpt}</p>
            <div className="mt-8 flex items-center gap-3">
              <SmartImage src={featured.authorImage} alt={featured.author} className="h-9 w-9 rounded-full object-cover" />
              <div>
                <p className="text-sm font-medium text-[#1a1510]">{featured.author}</p>
                <p className="text-xs text-[#8a7d6b]">{featured.date}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category filter */}
        <div className="mb-10 flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                cat === c ? "bg-[#1a1510] text-[#e8dcc4]" : "border border-[#d4c5a9]/30 text-[#8a7d6b] hover:border-[#1a1510]/30 hover:text-[#1a1510]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Article grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((a, i) => (
            <motion.article
              key={a.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group cursor-pointer"
            >
              <div className="h-56 overflow-hidden rounded-2xl bg-[#e8e0d5]">
                <SmartImage src={a.image} alt={a.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              </div>
              <div className="mt-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-full border border-[#d4c5a9]/40 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-[#8a7d6b]">{a.category}</span>
                  <span className="text-xs text-[#8a7d6b]">{a.readTime} read</span>
                </div>
                <h3 className="font-serif text-xl leading-snug text-[#1a1510] group-hover:text-[#8a7d6b] transition-colors">{a.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#8a7d6b] line-clamp-2">{a.excerpt}</p>
                <div className="mt-5 flex items-center gap-3">
                  <SmartImage src={a.authorImage} alt={a.author} className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <p className="text-xs font-medium text-[#1a1510]">{a.author}</p>
                    <p className="text-[10px] text-[#8a7d6b]">{a.date}</p>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}


