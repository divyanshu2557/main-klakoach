import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import Lenis from "@studio-freight/lenis";
import { api, type HomeFeed } from "../lib/api";
import {
  artisans,
  collections,
  inspirations,
  recommendations,
  spaces,
  testimonials,
  trending,
} from "../data";
import { useRouter } from "../store/router";
import { SmartImage } from "./SmartImage";

const footerRoutes = {
  shop: {
    "All Products": "marketplace",
    "New Arrivals": "marketplace",
    "Best Sellers": "marketplace",
    "Gift Ideas": "collections",
    Sale: "marketplace",
  },
  collections: {
    "Home Decor": "collections",
    "Wall Decor": "collections",
    "Table Decor": "collections",
    Lighting: "collections",
    Textiles: "collections",
    Planters: "collections",
  },
  care: {
    "Track Order": "care-track-order",
    "Returns & Refunds": "care-returns-refunds",
    "Shipping Info": "care-shipping-info",
    "Help Center": "care-help-center",
    FAQs: "care-faqs",
  },
  company: {
    "About Us": "about",
    "Our Artisans": "artisans",
    Sustainability: "company-sustainability",
    Careers: "company-careers",
    Press: "company-press",
  },
} as const;

function Hero({ onLogin, onNavigate, home }: { onLogin: () => void; onNavigate: (p: import("../store/router").Page) => void; home: HomeFeed | null }) {
  const hero = home?.hero;
  const topArtisan = home?.artisans?.[0];
  const topCollections = home?.collections?.slice(0, 3) ?? collections.slice(0, 3);
  return (
    <section className="relative min-h-[92vh] overflow-hidden bg-[#1a1510]">
      <div className="absolute inset-0">
        <SmartImage
          src={hero?.image ?? "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=2400&q=88"}
          alt="Handcrafted decor"
          className="absolute inset-0 h-full w-full scale-105 object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-linear-to-r from-[#1a1510] via-[#1a1510]/80 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-t from-[#1a1510] via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[92vh] max-w-7xl grid-cols-1 items-center gap-12 px-6 pt-16 md:grid-cols-2 lg:gap-20">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <p className="mb-6 text-xs uppercase tracking-[0.4em] text-[#d4c5a9]/60">klakoach</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.08] tracking-[-0.03em] text-[#e8dcc4] md:text-7xl lg:text-[5.5rem]">
            {hero?.title ?? "The luxury marketplace for objects with a human pulse."}
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-7 text-[#d4c5a9]/60">
            {hero?.subtitle ?? "Discover handmade works, follow exceptional artisans, and operate a secure global craft ecosystem with admin-grade intelligence."}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <button onClick={() => onNavigate("collections")} className="inline-flex items-center justify-center rounded-full bg-[#d4c5a9] px-7 py-4 text-sm font-semibold text-[#1a1510] transition hover:scale-[1.02] hover:bg-[#e8dcc4]">
              Explore the collection
            </button>
            <button onClick={onLogin} className="inline-flex items-center justify-center rounded-full border border-[#d4c5a9]/30 px-7 py-4 text-sm font-semibold text-[#e8dcc4] transition hover:border-[#d4c5a9]/60 hover:bg-[#d4c5a9]/10">
              View enterprise console
            </button>
          </div>
          <div className="mt-12 flex items-center gap-3 text-xs text-[#d4c5a9]/40">
            <div className="h-px w-8 bg-[#d4c5a9]/30" />
            <span>Scroll to explore</span>
          </div>
        </motion.div>

        <div className="hidden space-y-4 md:block">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="rounded-2xl border border-[#d4c5a9]/10 bg-[#1a1510]/80 p-5 backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/50">Top Artisan</span>
              <span className="text-[#d4c5a9]/30">↗</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-[#2a2218]">
                <SmartImage src={topArtisan?.image ?? artisans[0].image} alt={topArtisan?.name ?? artisans[0].name} className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="font-medium text-[#e8dcc4]">{topArtisan?.name ?? artisans[0].name}</p>
                <p className="text-xs text-[#d4c5a9]/50">
                  {topArtisan?.craft ?? artisans[0].craft} • {topArtisan?.followers ?? artisans[0].followers}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="rounded-2xl border border-[#d4c5a9]/10 bg-[#1a1510]/80 p-5 backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/50">Trending Collection</span>
              <span className="text-[#d4c5a9]/30">♡</span>
            </div>
            <p className="mb-3 font-medium text-[#e8dcc4]">Earthen Elegance</p>
            <div className="flex gap-2">
              {topCollections.map((c) => (
                <div key={c.title} className="h-16 w-16 overflow-hidden rounded-lg">
                  <SmartImage src={c.image} alt={c.title} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#d4c5a9]/40">From ₹2,490</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="rounded-2xl border border-[#d4c5a9]/10 bg-[#1a1510]/80 p-5 backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/50">AI Curated For You</span>
              <span className="text-[#d4c5a9]/30">↗</span>
            </div>
            <p className="font-medium text-[#e8dcc4]">Wabi-Sabi Living</p>
            <p className="text-xs text-[#d4c5a9]/50">Inspired by your taste</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatsBar({ home }: { home: HomeFeed | null }) {
  const stats = home
    ? [
        { value: home.stats.customers.toLocaleString(), label: "Happy Homes", icon: "⌂" },
        { value: home.stats.products.toLocaleString(), label: "Handcrafted Products", icon: "✦" },
        { value: home.stats.artisans.toLocaleString(), label: "Verified Artisans", icon: "♦" },
        { value: home.stats.categories.toLocaleString(), label: "Active Collections", icon: "◎" },
        { value: `${home.stats.orders.toLocaleString()}`, label: "Live Orders", icon: "★" },
      ]
    : [
        { value: "10K+", label: "Happy Homes", icon: "⌂" },
        { value: "50K+", label: "Handcrafted Products", icon: "✦" },
        { value: "500+", label: "Verified Artisans", icon: "♦" },
        { value: "25+", label: "Countries Shipping", icon: "◎" },
        { value: "4.9/5", label: "Customer Rating", icon: "★" },
      ];

  return (
    <section className="border-b border-[#d4c5a9]/10 bg-[#faf8f5] py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 md:grid-cols-5">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="mb-1 text-2xl text-[#d4c5a9]/50">{stat.icon}</p>
            <p className="text-3xl font-semibold tracking-tight text-[#1a1510]">{stat.value}</p>
            <p className="mt-1 text-sm text-[#8a7d6b]">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CuratedCollections() {
  return (
    <section id="collections" className="bg-[#faf8f5] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Curated Collections</p>
            <h2 className="max-w-lg font-serif text-4xl leading-tight tracking-[-0.03em] text-[#1a1510] md:text-5xl">
              Handpicked collections for every soulful space.
            </h2>
            <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#8a7d6b] transition hover:text-[#1a1510]">
              View all collections →
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group relative h-80 overflow-hidden rounded-2xl bg-[#1a1510]"
            >
              <SmartImage src={col.image} alt={col.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-linear-to-t from-[#1a1510] via-[#1a1510]/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="font-medium text-[#e8dcc4]">{col.title}</p>
                <p className="mt-1 text-sm text-[#d4c5a9]/50">{col.count}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AIRecommendations() {
  return (
    <section className="bg-[#faf8f5] px-6 pb-20 md:pb-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">AI Recommendations</p>
          <h2 className="max-w-lg font-serif text-4xl tracking-[-0.03em] text-[#1a1510] md:text-5xl">
            Handpicked for you, based on your taste.
          </h2>
          <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#8a7d6b] transition hover:text-[#1a1510]">
            View all recommendations →
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recommendations.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group cursor-pointer"
            >
              <div className="relative h-72 overflow-hidden rounded-2xl bg-[#e8e0d5]">
                <SmartImage src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <button className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-[#1a1510] opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                  ♡
                </button>
              </div>
              <div className="mt-4">
                <p className="font-medium text-[#1a1510]">{item.name}</p>
                <p className="mt-1 text-sm text-[#8a7d6b]">{item.artisan}</p>
                <p className="mt-2 font-medium text-[#1a1510]">{item.price}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtisanSpotlight() {
  return (
    <section className="bg-[#1a1510] px-6 py-20 text-white md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/50">Artisan Spotlight</p>
            <h2 className="max-w-lg font-serif text-4xl leading-tight tracking-[-0.03em] text-[#e8dcc4] md:text-5xl">
              Meet the makers behind timeless creations.
            </h2>
            <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#d4c5a9]/60 transition hover:text-[#e8dcc4]">
              View all artisans →
            </a>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {artisans.map((artisan, i) => (
            <motion.div
              key={artisan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <div className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-full border-2 border-[#d4c5a9]/20">
                <SmartImage src={artisan.image} alt={artisan.name} className="h-full w-full object-cover" />
              </div>
              <p className="font-medium text-[#e8dcc4]">{artisan.name}</p>
              <p className="mt-1 text-sm text-[#d4c5a9]/50">{artisan.craft}</p>
              <p className="mt-2 text-xs text-[#d4c5a9]/40">{artisan.followers} Followers</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ShopBySpace() {
  return (
    <section className="bg-[#faf8f5] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Shop by Space</p>
          <h2 className="max-w-lg font-serif text-4xl tracking-[-0.03em] text-[#1a1510] md:text-5xl">
            Designed to belong in your world.
          </h2>
          <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#8a7d6b] transition hover:text-[#1a1510]">
            Explore all spaces →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {spaces.map((space, i) => (
            <motion.div
              key={space.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group cursor-pointer"
            >
              <div className="relative h-52 overflow-hidden rounded-2xl bg-[#e8e0d5]">
                <SmartImage src={space.image} alt={space.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-[#1a1510]/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white backdrop-blur-md">
                    {space.name}
                  </div>
                </div>
              </div>
              <p className="mt-3 font-medium text-[#1a1510]">{space.name}</p>
              <p className="text-sm text-[#8a7d6b]">{space.count}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandStory() {
  return (
    <section className="bg-[#f5efe6] px-6 py-16 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-center">
        <div className="lg:w-1/3">
          <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] text-[#1a1510] md:text-5xl">
            Thoughtfully crafted.
            <br />
            Consciously made.
          </h2>
          <p className="mt-5 text-lg leading-7 text-[#8a7d6b]">
            We believe true luxury lies in craftsmanship, sustainability, and the stories behind every piece.
          </p>
          <a href="#" className="mt-6 inline-flex items-center rounded-full border border-[#1a1510]/20 px-6 py-3 text-sm font-medium text-[#1a1510] transition hover:bg-[#1a1510] hover:text-[#e8dcc4]">
            Read our Journal
          </a>
        </div>
        <div className="lg:w-2/3">
          <div className="overflow-hidden rounded-2xl">
            <SmartImage
              src="https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=1600&q=85"
              alt="Beautiful handcrafted decor"
              className="h-80 w-full object-cover md:h-[400px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrendingProducts() {
  return (
    <section className="bg-[#faf8f5] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Trending Now</p>
            <h2 className="font-serif text-4xl tracking-[-0.03em] text-[#1a1510] md:text-5xl">
              What's loved by our community
            </h2>
          </div>
          <a href="#" className="hidden text-sm font-medium text-[#8a7d6b] transition hover:text-[#1a1510] md:inline-flex md:items-center md:gap-2">
            View all products →
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {trending.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group cursor-pointer"
            >
              <div className="relative h-60 overflow-hidden rounded-2xl bg-[#e8e0d5]">
                <SmartImage src={item.image} alt={item.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <button className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-[#1a1510] opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                  ♡
                </button>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-[#1a1510]">{item.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#1a1510]">{item.price}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="bg-[#f5efe6] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">What Our Customers Say</p>
          <h2 className="font-serif text-4xl tracking-[-0.03em] text-[#1a1510] md:text-5xl">
            Loved by thousands of homes worldwide.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl bg-white/70 p-8 shadow-sm"
            >
              <div className="mb-4 text-[#d4a843]">★★★★★</div>
              <p className="text-base leading-7 text-[#1a1510]/80">"{t.text}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[#e8e0d5]" />
                <div>
                  <p className="text-sm font-medium text-[#1a1510]">{t.name}</p>
                  <p className="text-xs text-[#8a7d6b]">{t.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InspirationGallery() {
  return (
    <section className="bg-[#faf8f5] px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[#8a7d6b]">Get Inspired</p>
            <h2 className="font-serif text-4xl tracking-[-0.03em] text-[#1a1510] md:text-5xl">
              Ideas and inspirations for every corner of your home.
            </h2>
          </div>
          <a href="#" className="hidden text-sm font-medium text-[#8a7d6b] transition hover:text-[#1a1510] md:inline-flex md:items-center md:gap-2">
            View all inspiration →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {inspirations.map((insp, i) => (
            <motion.div
              key={insp.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group relative h-64 overflow-hidden rounded-2xl bg-[#1a1510] sm:h-72"
            >
              <SmartImage src={insp.image} alt={insp.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-linear-to-t from-[#1a1510]/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white backdrop-blur-md">
                  <span>klakoach</span>
                  <span className="text-[#d4c5a9]/60">•</span>
                  <span>{insp.title}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="bg-[#2a2218] px-6 py-16 md:py-20">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row md:justify-between">
        <div>
          <h2 className="font-serif text-3xl tracking-[-0.02em] text-[#e8dcc4] md:text-4xl">Be the first to know</h2>
          <p className="mt-3 text-[#d4c5a9]/60">Get exclusive offers, new arrivals and inspiration straight to your inbox.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <input
            className="w-full rounded-full border border-[#d4c5a9]/20 bg-transparent px-6 py-3 text-sm text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/40 sm:w-72"
            placeholder="Enter your email address"
          />
          <button className="rounded-full bg-[#d4c5a9] px-8 py-3 text-sm font-semibold text-[#1a1510] transition hover:bg-[#e8dcc4]">
            Subscribe ↗
          </button>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-7xl text-center text-xs text-[#d4c5a9]/30">No spam. Unsubscribe anytime.</p>
    </section>
  );
}

function Footer({ onNavigate }: { onNavigate: (p: import("../store/router").Page) => void }) {
  return (
    <footer className="bg-[#1a1510] px-6 py-16 text-[#d4c5a9]/60">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <a href="#" className="flex items-center gap-3">
              <img src="/logo.png" alt="KlaKoach Logo" className="h-10 w-auto object-contain drop-shadow-md brightness-110" />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-6">
              The luxury marketplace for handcrafted home decor. Curated with care, crafted with soul.
            </p>
            <div className="mt-6 flex gap-4">
              {["Instagram", "Facebook", "Pinterest"].map((s) => (
                <a key={s} href="#" className="text-xs uppercase tracking-[0.15em] transition hover:text-[#e8dcc4]">
                  {s}
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#e8dcc4]">Shop</h4>
            <ul className="space-y-3 text-sm">
              {Object.entries(footerRoutes.shop).map(([item, route]) => (
                <li key={item}>
                  <button onClick={() => onNavigate(route)} className="transition hover:text-[#e8dcc4]">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#e8dcc4]">Collections</h4>
            <ul className="space-y-3 text-sm">
              {Object.entries(footerRoutes.collections).map(([item, route]) => (
                <li key={item}>
                  <button onClick={() => onNavigate(route)} className="transition hover:text-[#e8dcc4]">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#e8dcc4]">Customer Care</h4>
            <ul className="space-y-3 text-sm">
              {Object.entries(footerRoutes.care).map(([item, route]) => (
                <li key={item}>
                  <button onClick={() => onNavigate(route)} className="transition hover:text-[#e8dcc4]">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
            <h4 className="mt-8 mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#e8dcc4]">Company</h4>
            <ul className="space-y-3 text-sm">
              {Object.entries(footerRoutes.company).map(([item, route]) => (
                <li key={item}>
                  <button onClick={() => onNavigate(route)} className="transition hover:text-[#e8dcc4]">
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 border-t border-[#d4c5a9]/10 pt-8 md:flex-row md:justify-between">
          <p className="text-xs">© 2024 klakoach. All rights reserved.</p>
          <div className="flex gap-6 text-xs">
            <a href="#" className="transition hover:text-[#e8dcc4]">
              Privacy Policy
            </a>
            <a href="#" className="transition hover:text-[#e8dcc4]">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function LandingExperience({ onLogin }: { onLogin: () => void }) {
  const { navigate } = useRouter();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, restDelta: 0.001 });
  const [home, setHome] = useState<HomeFeed | null>(null);

  useEffect(() => {
    api.content.home().then(setHome).catch(() => setHome(null));
  }, []);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };

    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#faf8f5] font-sans antialiased selection:bg-[#d4c5a9] selection:text-[#1a1510]">
      <motion.div className="fixed left-0 right-0 top-0 z-90 h-0.5 origin-left bg-[#d4c5a9]" style={{ scaleX }} />
      <Hero onLogin={onLogin} onNavigate={navigate} home={home} />
      <StatsBar home={home} />
      <CuratedCollections />
      <AIRecommendations />
      <ArtisanSpotlight />
      <ShopBySpace />
      <BrandStory />
      <TrendingProducts />
      <TestimonialsSection />
      <InspirationGallery />
      <Newsletter />
      <Footer onNavigate={navigate} />
    </main>
  );
}
