import { motion } from "framer-motion";


const values = [
  { icon: "✦", title: "Radical Authenticity", desc: "Every product on klakoach is handmade by a verified artisan. No mass production. No exceptions." },
  { icon: "◎", title: "Fair & Transparent", desc: "Artisans keep 85% of every sale. We believe the maker deserves to thrive." },
  { icon: "♦", title: "Consciously Sourced", desc: "We prioritize natural materials, traditional techniques, and sustainable practices." },
  { icon: "⊡", title: "Global, Yet Local", desc: "We ship to 25+ countries while keeping craft traditions rooted in their communities." },
];

const team = [
  { name: "Madhav Dhavan", role: "Founder & CEO", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80" },
  { name: "Divyanshu Mittal", role: "Co-founder & CTO", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80" },
  { name: "Kujika Garg", role: "Co-founder & COO", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80" },
  { name: "Naveen Maan", role: "Co-founder", image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80" },
];

const milestones = [
  { year: "2019", event: "Founded in a small studio in Bangalore with 12 artisans." },
  { year: "2020", event: "Launched online marketplace. 500 orders in the first month." },
  { year: "2021", event: "Expanded to 10 countries. Crossed 100 verified artisans." },
  { year: "2022", event: "Introduced AI-powered curation and artisan analytics." },
  { year: "2023", event: "500+ artisans. ₹10Cr+ paid out to makers." },
  { year: "2024", event: "25 countries. 50,000+ handcrafted products. Still growing." },
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden md:h-[500px]">
        <img
          src="https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=2400&q=85"
          alt="About klakoach"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1510]/70 via-[#1a1510]/40 to-[#faf8f5]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/70 mb-4">
            our story
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-serif text-4xl md:text-6xl text-[#e8dcc4] tracking-[-0.03em] max-w-3xl">
            We exist to give craft the platform it deserves.
          </motion.h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16">

        {/* Mission */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center mb-24">
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Our Mission</p>
            <h2 className="font-serif text-4xl leading-tight text-[#1a1510] md:text-5xl">
              Thoughtfully crafted.<br />Consciously made.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[#8a7d6b]">
              klakoach was born from a simple belief: that the most beautiful objects in the world are made by human hands, not machines. We built a platform where artisans can thrive, collectors can discover, and craft can be celebrated as the luxury it truly is.
            </p>
            <p className="mt-4 text-lg leading-8 text-[#8a7d6b]">
              Every piece on klakoach carries a story — of a tradition passed down through generations, of a material sourced with care, of a maker who poured their soul into their work.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-3xl">
            <img
              src="https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=1200&q=85"
              alt="Craftsmanship"
              className="h-80 w-full object-cover md:h-[420px]"
            />
          </motion.div>
        </div>

        {/* Values */}
        <div className="mb-24">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">What We Stand For</p>
          <h2 className="mb-12 font-serif text-4xl text-[#1a1510]">Our values.</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-[#d4c5a9]/30 bg-white p-7"
              >
                <p className="mb-4 text-2xl text-[#d4a843]">{v.icon}</p>
                <p className="font-semibold text-[#1a1510]">{v.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#8a7d6b]">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-24 rounded-3xl bg-[#1a1510] px-8 py-12 md:px-14">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/40">Our Journey</p>
          <h2 className="mb-12 font-serif text-4xl text-[#e8dcc4]">Five years of craft.</h2>
          <div className="space-y-0">
            {milestones.map((m, i) => (
              <motion.div
                key={m.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex gap-8 border-b border-[#d4c5a9]/10 py-6 last:border-b-0"
              >
                <p className="w-16 shrink-0 font-serif text-2xl text-[#d4a843]">{m.year}</p>
                <p className="text-[#d4c5a9]/70 leading-7">{m.event}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mb-24">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">The Team</p>
          <h2 className="mb-12 font-serif text-4xl text-[#1a1510]">The people behind klakoach.</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="mx-auto mb-5 flex h-32 w-32 items-center justify-center rounded-full border-2 border-[#d4c5a9]/30 bg-linear-to-br from-[#d4a843]/10 to-[#1a1510]/5 shadow-inner">
                  <span className="font-serif text-3xl font-light tracking-wide text-[#1a1510] uppercase">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <p className="font-medium text-[#1a1510]">{t.name}</p>
                <p className="mt-1 text-sm text-[#8a7d6b]">{t.role}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="overflow-hidden rounded-3xl">
          <div className="relative h-64">
            <img
              src="https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=2000&q=85"
              alt="Join klakoach"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#1a1510]/70" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <h3 className="font-serif text-3xl text-[#e8dcc4] mb-6">Ready to explore?</h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="rounded-full bg-[#d4c5a9] px-8 py-3.5 text-sm font-semibold text-[#1a1510] hover:bg-[#e8dcc4]">
                  Shop the collection
                </button>
                <button className="rounded-full border border-[#d4c5a9]/40 px-8 py-3.5 text-sm font-semibold text-[#e8dcc4] hover:bg-[#d4c5a9]/10">
                  Become an artisan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


