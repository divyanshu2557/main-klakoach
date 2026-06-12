import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Category, type Product } from "../lib/api";
import { recommendations, trending } from "../data";
import { useCart, useWishlist, useFilterStore } from "../store";
import { SmartImage } from "./SmartImage";

const fallbackCategories: Category[] = [
  { id: "local-ceramics", name: "Ceramics", slug: "ceramics" },
  { id: "local-textiles", name: "Textiles", slug: "textiles" },
  { id: "local-lighting", name: "Lighting", slug: "lighting" },
  { id: "local-woodwork", name: "Woodwork", slug: "woodwork" },
  { id: "local-metal", name: "Brass & Metal", slug: "brass-metal" },
];

const categoryCycle = fallbackCategories.map((category) => category.slug);

const roomProfiles = [
  { id: "living", label: "Living", categories: ["textiles", "lighting", "woodwork", "ceramics"] },
  { id: "dining", label: "Dining", categories: ["ceramics", "brass-metal", "woodwork"] },
  { id: "bedroom", label: "Bedroom", categories: ["textiles", "lighting", "ceramics"] },
  { id: "entry", label: "Entry", categories: ["brass-metal", "ceramics", "lighting"] },
] as const;

const moodProfiles = [
  { id: "earth", label: "Earth", keywords: ["terracotta", "raku", "earth", "ceramic", "stoneware", "planter"] },
  { id: "quiet", label: "Quiet", keywords: ["linen", "throw", "macrame", "jute", "rattan", "wabi"] },
  { id: "glow", label: "Glow", keywords: ["lamp", "light", "brass", "bowl", "solstice", "pendant"] },
] as const;

const materialProfiles = [
  { id: "all", label: "All materials", keywords: [] },
  { id: "ceramic", label: "Ceramic", keywords: ["ceramic", "terracotta", "raku", "stoneware", "clay", "planter", "vase", "mug"] },
  { id: "textile", label: "Textile", keywords: ["linen", "jute", "macrame", "woven", "rug", "throw", "cushion", "textile"] },
  { id: "wood", label: "Wood", keywords: ["wood", "wooden", "carved", "bowl", "rattan"] },
  { id: "metal", label: "Metal", keywords: ["brass", "metal", "hammered", "solstice"] },
] as const;

const categoryImageFallbacks: Record<string, string> = {
  ceramics: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=82",
  decor: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=82",
  lighting: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&w=900&q=82",
  textiles: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=82",
  woodwork: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=82",
  "brass-metal": "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=82",
};

type RoomId = (typeof roomProfiles)[number]["id"];
type MoodId = (typeof moodProfiles)[number]["id"];
type MaterialId = (typeof materialProfiles)[number]["id"];
type ViewMode = "gallery" | "compact";

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parsePriceToCents(price: string) {
  return Number(price.replace(/[^\d]/g, "")) * 100;
}

function fallbackProductFrom(item: { name: string; price: string; image: string; artisan?: string }, index: number): Product {
  const categorySlug = categoryCycle[index % categoryCycle.length];
  const category = fallbackCategories.find((entry) => entry.slug === categorySlug) ?? fallbackCategories[0];

  return {
    id: `local-product-${index}-${slugify(item.name)}`,
    title: item.name,
    slug: slugify(item.name),
    price_cents: parsePriceToCents(item.price),
    image_url: item.image,
    category: category.name,
    category_slug: category.slug,
    artisan: item.artisan ?? "klakoach Studio",
    stock: [14, 8, 5, 3, 11, 6, 9, 4, 12, 7][index % 10],
    avg_rating: [4.9, 4.8, 4.7, 4.6, 4.9, 4.5][index % 6],
    review_count: [42, 31, 27, 18, 36, 22][index % 6],
    description: "Curated handmade object selected for material quality, room fit, and artisan finish.",
    created_at: `2026-05-${String(20 - (index % 12)).padStart(2, "0")}T10:00:00.000Z`,
  };
}

const fallbackProducts: Product[] = [
  ...recommendations.map((item, index) => fallbackProductFrom(item, index)),
  ...trending.map((item, index) => fallbackProductFrom(item, index + recommendations.length)),
];

function fmtPrice(cents: number) {
  return `₹ ${(cents / 100).toLocaleString("en-IN")}`;
}

function productText(product: Product) {
  return `${product.title} ${product.description ?? ""} ${product.category} ${product.artisan}`.toLowerCase();
}

function matchesMaterial(product: Product, material: MaterialId) {
  if (material === "all") return true;
  const selected = materialProfiles.find((entry) => entry.id === material);
  const text = productText(product);
  return Boolean(selected?.keywords.some((keyword) => text.includes(keyword)));
}

function productImageFallback(product: Product) {
  return categoryImageFallbacks[product.category_slug] ?? categoryImageFallbacks.decor;
}

function deliveryWindow(product: Product) {
  if (product.stock <= 0) return "Restock alert";
  if (product.stock <= 3) return "Ships in 5-7 days";
  if (product.price_cents >= 350000) return "Ships insured in 4-6 days";
  return "Ships in 2-4 days";
}

function careNote(product: Product) {
  const text = productText(product);
  if (text.includes("brass") || text.includes("metal")) return "Wipe dry, avoid acids, polish lightly.";
  if (text.includes("linen") || text.includes("jute") || text.includes("woven")) return "Spot clean cold, air dry in shade.";
  if (text.includes("wood") || text.includes("rattan")) return "Dust often, oil lightly every few months.";
  if (text.includes("lamp") || text.includes("light")) return "Use warm LED bulbs and dry dust only.";
  return "Hand wash gently and avoid harsh scrubbers.";
}

function scaleProfile(product: Product) {
  if (product.price_cents >= 350000 || product.category_slug === "lighting" || product.category_slug === "woodwork") {
    return { label: "Statement", footprint: "60-90 cm" };
  }
  if (product.price_cents >= 220000) return { label: "Anchor", footprint: "35-60 cm" };
  return { label: "Accent", footprint: "12-35 cm" };
}

function iconPath(name: "search" | "sliders" | "eye" | "bag" | "compare" | "spark" | "wand" | "truck" | "ruler" | "chart") {
  const paths = {
    search: "M21 21l-4.35-4.35m1.1-5.4a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z",
    sliders: "M4 7h10m4 0h2M4 17h2m4 0h10M8 5v4m6 6v4",
    eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z M12 15a3 3 0 100-6 3 3 0 000 6z",
    bag: "M8 8V6a4 4 0 018 0v2m-10 0h12l-1 12H7L6 8z",
    compare: "M8 7h11M8 12h7M8 17h11M4 7h.01M4 12h.01M4 17h.01",
    spark: "M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z",
    wand: "M4 20l10.5-10.5m2-5.5l.6 1.8L19 6l-1.9.7-.6 1.8-.6-1.8L14 6l1.9-.7.6-1.8zM5 6l.4 1.1L6.5 7.5l-1.1.4L5 9l-.4-1.1-1.1-.4 1.1-.4L5 6zM17 15l.4 1.1 1.1.4-1.1.4L17 18l-.4-1.1-1.1-.4 1.1-.4L17 15z",
    truck: "M3 7h11v8H3V7zm11 3h3.5L21 13.5V15h-7v-5zM7 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z",
    ruler: "M4 17l13-13 3 3L7 20l-3-3zm4-4l2 2m2-6l2 2m2-6l2 2",
    chart: "M4 19V5m0 14h16M8 16v-5m5 5V8m5 8v-9",
  };
  return paths[name];
}

type IconName = Parameters<typeof iconPath>[0];

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPath(name)} />
    </svg>
  );
}

export function MarketplacePage() {
  const [search, setSearch] = useState("");
  const { wishlistOnly, setWishlistOnly, category: cat, setCategory: setCat } = useFilterStore();
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<RoomId>("living");
  const [mood, setMood] = useState<MoodId>("earth");
  const [material, setMaterial] = useState<MaterialId>("all");
  const [maxBudget, setMaxBudget] = useState(15000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [view, setView] = useState<ViewMode>("gallery");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const { add } = useCart();
  const { toggle, has } = useWishlist();

  useEffect(() => {
    setLoading(true);
    const apiSort = sort === "price_asc" || sort === "price_desc" ? sort : undefined;

    // Record search event if search query exists
    if (search.trim().length > 2) {
      api.recommendations.recordEvent({ eventType: "SEARCH", query: search }).catch(() => {});
    }

    Promise.all([
      api.products.list({
        search: search || undefined,
        category: cat === "all" ? undefined : cat,
        sort: apiSort,
        limit: 48,
      }),
      api.products.categories(),
    ])
      .then(([productData, categoryRows]) => {
        setProducts(productData.products.length ? productData.products : fallbackProducts);
        setCategories(categoryRows.length ? categoryRows : fallbackCategories);
      })
      .catch(() => {
        setProducts(fallbackProducts);
        setCategories(fallbackCategories);
      })
      .finally(() => setLoading(false));
  }, [search, cat, sort]);

  const categoryOptions = useMemo(
    () => [{ label: "All", value: "all" }, ...categories.map((category) => ({ label: category.name, value: category.slug }))],
    [categories],
  );

  const scoreProduct = (product: Product) => {
    const selectedRoom = roomProfiles.find((entry) => entry.id === room) ?? roomProfiles[0];
    const selectedMood = moodProfiles.find((entry) => entry.id === mood) ?? moodProfiles[0];
    const text = productText(product);
    let score = 0;

    if (selectedRoom.categories.includes(product.category_slug as never)) score += 36;
    selectedMood.keywords.forEach((keyword) => {
      if (text.includes(keyword)) score += 11;
    });
    if (matchesMaterial(product, material)) score += material === "all" ? 0 : 14;
    if (product.price_cents <= maxBudget * 100) score += 18;
    if (product.stock > 0) score += 10;
    if (product.avg_rating >= 4.7) score += 10;
    if (product.review_count > 20) score += 6;

    return score;
  };

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return [...products]
      .filter((product) => {
        const text = productText(product);
        const matchesSearch = !needle || text.includes(needle);
        const matchesCategory = cat === "all" || product.category_slug === cat;
        const matchesMaterialFilter = matchesMaterial(product, material);
        const matchesBudget = product.price_cents <= maxBudget * 100;
        const matchesStock = !inStockOnly || product.stock > 0;
        const matchesWishlist = !wishlistOnly || has(product.id);
        const matchesRating = product.avg_rating >= minRating;

        return matchesSearch && matchesCategory && matchesMaterialFilter && matchesBudget && matchesStock && matchesWishlist && matchesRating;
      })
      .sort((a, b) => {
        if (sort === "price_asc") return a.price_cents - b.price_cents;
        if (sort === "price_desc") return b.price_cents - a.price_cents;
        if (sort === "rating_desc") return b.avg_rating - a.avg_rating;
        if (sort === "stock_desc") return b.stock - a.stock;
        if (sort === "newest") return Date.parse(b.created_at) - Date.parse(a.created_at);
        return scoreProduct(b) - scoreProduct(a) || Date.parse(b.created_at) - Date.parse(a.created_at);
      });
  }, [cat, has, inStockOnly, material, maxBudget, minRating, products, room, mood, search, sort, wishlistOnly]);

  const curatedProducts = useMemo(() => [...filteredProducts].sort((a, b) => scoreProduct(b) - scoreProduct(a)).slice(0, 3), [filteredProducts, room, mood, material, maxBudget]);
  const compareProducts = compareIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as Product[];
  const bundleProducts = useMemo(() => {
    const picked: Product[] = [];
    let total = 0;

    [...filteredProducts]
      .filter((product) => product.stock > 0)
      .sort((a, b) => scoreProduct(b) - scoreProduct(a))
      .forEach((product) => {
        if (picked.length >= 3) return;
        const repeatsCategory = picked.some((entry) => entry.category_slug === product.category_slug);
        const fitsBudget = total + product.price_cents <= maxBudget * 100;

        if ((fitsBudget || picked.length === 0) && !repeatsCategory) {
          picked.push(product);
          total += product.price_cents;
        }
      });

    return picked;
  }, [filteredProducts, material, maxBudget, mood, room]);
  const bundleTotal = bundleProducts.reduce((sum, product) => sum + product.price_cents, 0);
  const bestFit = filteredProducts[0] ? Math.round(scoreProduct(filteredProducts[0])) : 0;
  const avgPrice = filteredProducts.length ? Math.round(filteredProducts.reduce((sum, product) => sum + product.price_cents, 0) / filteredProducts.length) : 0;
  const lowStockCount = filteredProducts.filter((product) => product.stock > 0 && product.stock <= 3).length;
  const activeFilters = [cat !== "all", search.trim().length > 0, material !== "all", inStockOnly, wishlistOnly, minRating > 0, maxBudget < 15000].filter(Boolean).length;

  const toggleCompare = (product: Product) => {
    setCompareIds((current) => {
      if (current.includes(product.id)) return current.filter((id) => id !== product.id);
      if (current.length >= 3) return [...current.slice(1), product.id];
      return [...current, product.id];
    });
  };

  const clearFilters = () => {
    setSearch("");
    setCat("all");
    setSort("featured");
    setMaterial("all");
    setMaxBudget(15000);
    setInStockOnly(false);
    setWishlistOnly(false);
    setMinRating(0);
  };

  const addBundle = () => {
    bundleProducts.forEach((product) => add(product));
  };

  return (
    <div className="min-h-screen bg-[#f7f3ec] text-[#1a1510] overflow-x-hidden">
      <div className="relative h-[24rem] overflow-hidden md:h-[31rem]">
        <SmartImage
          src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=2400&q=85"
          alt="Handcrafted marketplace interior"
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-linear-to-r from-[#17110d] via-[#17110d]/72 to-[#0e3b35]/28" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-linear-to-t from-[#f7f3ec] to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-6 pt-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d4c5a9]/25 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#d4c5a9] backdrop-blur">
              <Icon name="spark" />
              klakoach marketplace
            </div>
            <h1 className="font-serif text-5xl leading-[1.02] tracking-[-0.03em] text-[#f3ead8] md:text-7xl">
              Discover, tune, compare.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#d4c5a9]/78 md:text-lg">
              Shape every room with maker-led pieces, transparent stock, and sharper ways to choose the object that belongs in your home.
            </p>
            <div className="mt-7 grid max-w-2xl grid-cols-3 gap-2 text-[#f3ead8]">
              {[
                { value: "48", label: "live picks" },
                { value: "3-way", label: "compare lab" },
                { value: "2-4d", label: "fast ship" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/12 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="font-serif text-2xl leading-none">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4c5a9]/68">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="sticky top-[57px] z-30 border-y border-[#c9b99d]/30 bg-[#f7f3ec]/94 px-6 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {categoryOptions.map((category) => (
              <button
                key={category.value}
                onClick={() => setCat(category.value)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  cat === category.value
                    ? "bg-[#172e2a] text-[#f3ead8] shadow-lg shadow-[#172e2a]/15"
                    : "border border-[#c9b99d]/60 bg-white/55 text-[#6f6254] hover:border-[#172e2a]/30 hover:text-[#172e2a]"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px] lg:w-[34rem]">
            <label className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#76695a]">
                <Icon name="search" />
              </span>
              <input
                className="h-11 w-full rounded-lg border border-[#c9b99d]/60 bg-white/80 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#8a7d6b]/65 focus:border-[#172e2a]/40 focus:bg-white"
                placeholder="Search material, artisan, object"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              className="h-11 rounded-lg border border-[#c9b99d]/60 bg-white/80 px-4 text-sm font-medium text-[#5e5145] outline-none transition focus:border-[#172e2a]/40"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="featured">Best Match</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Top Rated</option>
              <option value="stock_desc">Most Available</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a2d3b]">Atelier tools</p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#172e2a]">Style matcher</h2>
              </div>
              <Icon name="sliders" className="h-6 w-6 text-[#0f766e]" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">Room</p>
                <div className="grid grid-cols-2 gap-2">
                  {roomProfiles.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setRoom(entry.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        room === entry.id ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145] hover:border-[#0f766e]/50"
                      }`}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">Mood</p>
                <div className="grid grid-cols-3 gap-2">
                  {moodProfiles.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setMood(entry.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        mood === entry.id ? "border-[#8a2d3b] bg-[#8a2d3b] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145] hover:border-[#8a2d3b]/50"
                      }`}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">Material lens</p>
                <span className="text-xs font-semibold text-[#0f766e]">Advanced match filter</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {materialProfiles.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setMaterial(entry.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      material === entry.id ? "border-[#172e2a] bg-[#172e2a] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145] hover:border-[#172e2a]/45"
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[1fr_1.2fr]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">Budget</p>
                  <span className="text-sm font-semibold text-[#172e2a]">Under ₹ {maxBudget.toLocaleString("en-IN")}</span>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={15000}
                  step={500}
                  value={maxBudget}
                  onChange={(event) => setMaxBudget(Number(event.target.value))}
                  className="w-full accent-[#0f766e]"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  onClick={() => setInStockOnly((value) => !value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${inStockOnly ? "border-[#172e2a] bg-[#172e2a] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145]"}`}
                >
                  In stock
                </button>
                <button
                  onClick={() => setWishlistOnly(!wishlistOnly)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${wishlistOnly ? "border-[#8a2d3b] bg-[#8a2d3b] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145]"}`}
                >
                  Wishlist
                </button>
                <button
                  onClick={() => setMinRating((value) => (value > 0 ? 0 : 4.5))}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${minRating > 0 ? "border-[#b7791f] bg-[#b7791f] text-white" : "border-[#d8c8aa] bg-[#fbfaf7] text-[#5e5145]"}`}
                >
                  4.5+ rating
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#172e2a]/15 bg-[#172e2a] p-5 text-[#f3ead8] shadow-xl shadow-[#172e2a]/10">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#90d4c7]">Best fit now</p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em]">Curated shortlist</h2>
              </div>
              <button onClick={clearFilters} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-[#d4c5a9] transition hover:border-white/30 hover:text-white">
                Reset
              </button>
            </div>
            <div className="space-y-3">
              {curatedProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    setQuickView(product);
                    api.recommendations.recordEvent({ eventType: "VIEW", productId: product.id }).catch(() => {});
                  }}
                  className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/7 p-2 text-left transition hover:bg-white/12"
                >
                  <SmartImage src={product.image_url} fallbackSrc={productImageFallback(product)} alt={product.title} className="h-16 w-16 rounded-md object-cover" loading="eager" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{product.title}</span>
                    <span className="mt-1 block text-xs text-[#d4c5a9]/65">{product.category} · {Math.round(scoreProduct(product))}% match</span>
                  </span>
                  <span className="text-sm font-semibold">{fmtPrice(product.price_cents)}</span>
                </button>
              ))}
              {curatedProducts.length === 0 && <p className="rounded-lg border border-white/10 bg-white/7 p-4 text-sm text-[#d4c5a9]/70">No matching shortlist yet.</p>}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Best fit", value: `${bestFit}%`, icon: "wand" as const, note: "top-ranked match" },
            { label: "Avg. price", value: fmtPrice(avgPrice), icon: "chart" as const, note: "inside current filters" },
            { label: "Low stock", value: String(lowStockCount), icon: "spark" as const, note: "pieces moving fast" },
            { label: "Bundle total", value: fmtPrice(bundleTotal), icon: "bag" as const, note: `${bundleProducts.length} room-ready picks` },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between text-[#0f766e]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">{metric.label}</p>
                <Icon name={metric.icon} />
              </div>
              <p className="font-serif text-3xl leading-none text-[#172e2a]">{metric.value}</p>
              <p className="mt-2 text-xs font-medium text-[#76695a]">{metric.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a2d3b]">Room builder</p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#172e2a]">Auto bundle</h2>
              </div>
              <Icon name="wand" className="h-6 w-6 text-[#0f766e]" />
            </div>
            <div className="space-y-3">
              {bundleProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => {
                    setQuickView(product);
                    api.recommendations.recordEvent({ eventType: "VIEW", productId: product.id }).catch(() => {});
                  }}
                  className="grid w-full grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-lg border border-[#d8c8aa]/70 bg-[#fbfaf7] p-2 text-left transition hover:border-[#0f766e]/45"
                >
                  <SmartImage src={product.image_url} fallbackSrc={productImageFallback(product)} alt={product.title} className="h-14 w-14 rounded-md object-cover" />
                  <span>
                    <span className="block text-sm font-semibold text-[#172e2a]">{product.title}</span>
                    <span className="mt-1 block text-xs text-[#76695a]">{scaleProfile(product).label} · {deliveryWindow(product)}</span>
                  </span>
                  <span className="text-sm font-semibold text-[#172e2a]">{fmtPrice(product.price_cents)}</span>
                </button>
              ))}
              {bundleProducts.length === 0 && <p className="rounded-lg border border-[#d8c8aa] bg-[#fbfaf7] p-4 text-sm text-[#76695a]">Adjust filters to build a room bundle.</p>}
            </div>
            <div className="mt-5 rounded-lg bg-[#172e2a] p-4 text-[#f3ead8]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#90d4c7]">Plan cost</p>
                  <p className="mt-1 font-serif text-2xl">{fmtPrice(bundleTotal)}</p>
                </div>
                <button
                  onClick={addBundle}
                  disabled={bundleProducts.length === 0}
                  className="rounded-lg bg-[#d4c5a9] px-4 py-3 text-sm font-semibold text-[#172e2a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Add bundle
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#d4c5a9]/72">Greedy planner picks high-fit pieces across different categories and keeps them under the selected budget where possible.</p>
            </div>
          </div>

          <div className="rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8a2d3b]">Decision lab</p>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em] text-[#172e2a]">Why these win</h2>
              </div>
              <Icon name="chart" className="h-6 w-6 text-[#0f766e]" />
            </div>
            <div className="space-y-4">
              {curatedProducts.map((product) => {
                const fit = Math.min(100, Math.round(scoreProduct(product)));
                const scale = scaleProfile(product);

                return (
                  <div key={product.id} className="rounded-lg border border-[#d8c8aa]/70 bg-[#fbfaf7] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#172e2a]">{product.title}</p>
                        <p className="mt-1 text-xs text-[#76695a]">{product.category} · {product.artisan}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-[#0f766e]">{fit}% fit</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d8c8aa]/55">
                      <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${fit}%` }} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[#5e5145] sm:grid-cols-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                        <Icon name="ruler" />
                        {scale.label}, {scale.footprint}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                        <Icon name="truck" />
                        {deliveryWindow(product)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                        <Icon name="spark" />
                        {product.avg_rating >= 4.7 ? "Collector favorite" : "Fresh find"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {curatedProducts.length === 0 && <p className="rounded-lg border border-[#d8c8aa] bg-[#fbfaf7] p-4 text-sm text-[#76695a]">No decision data for the current filters.</p>}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#76695a]">
                {filteredProducts.length} of {products.length} pieces
                {activeFilters > 0 ? ` · ${activeFilters} active filter${activeFilters === 1 ? "" : "s"}` : ""}
              </p>
              {loading && <p className="mt-1 text-sm text-[#76695a]">Refreshing catalog...</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCompareMode((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  compareMode ? "border-[#172e2a] bg-[#172e2a] text-white" : "border-[#d8c8aa] bg-white/70 text-[#5e5145] hover:border-[#172e2a]/35"
                }`}
              >
                <Icon name="compare" />
                Compare
              </button>
              <div className="flex rounded-lg border border-[#d8c8aa] bg-white/70 p-1">
                {(["gallery", "compact"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setView(mode)}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition ${view === mode ? "bg-[#0f766e] text-white" : "text-[#5e5145] hover:text-[#0f766e]"}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && products.length === 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-[26rem] animate-pulse rounded-lg bg-white/70" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-lg border border-[#d8c8aa] bg-white/70 px-6 py-16 text-center">
              <p className="font-serif text-3xl text-[#172e2a]">No pieces match this setup.</p>
              <button onClick={clearFilters} className="mt-5 rounded-lg bg-[#172e2a] px-5 py-3 text-sm font-semibold text-white">
                Reset filters
              </button>
            </div>
          ) : (
            <div className={`grid gap-6 ${view === "gallery" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-2"}`}>
              {filteredProducts.map((product) => {
                const compared = compareIds.includes(product.id);
                const wishlisted = has(product.id);

                return (
                  <article
                    key={product.id}
                    className={`group rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#172e2a]/10 ${
                      view === "compact" ? "grid grid-cols-[8.5rem_1fr] gap-4" : ""
                    }`}
                  >
                    <div className={`relative overflow-hidden rounded-lg bg-[#ded1bf] ${view === "compact" ? "h-36" : "h-72"}`}>
                      <SmartImage src={product.image_url} fallbackSrc={productImageFallback(product)} alt={product.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="eager" />
                      <div className="absolute left-3 top-3 rounded-full bg-[#172e2a]/88 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4c5a9] backdrop-blur">
                        {Math.round(scoreProduct(product))}% fit
                      </div>
                      {product.stock <= 3 && (
                        <span className="absolute bottom-3 left-3 rounded-full bg-[#8a2d3b]/90 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur">
                          Only {product.stock} left
                        </span>
                      )}
                      <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(product.id);
                          }}
                          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                          className={`grid h-9 w-9 place-items-center rounded-full border border-white/35 backdrop-blur ${wishlisted ? "bg-[#8a2d3b] text-white" : "bg-white/82 text-[#172e2a]"}`}
                        >
                          ♡
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setQuickView(product);
                            api.recommendations.recordEvent({ eventType: "VIEW", productId: product.id }).catch(() => {});
                          }}
                          aria-label="Open quick view"
                          className="grid h-9 w-9 place-items-center rounded-full border border-white/35 bg-white/82 text-[#172e2a] backdrop-blur"
                        >
                          <Icon name="eye" />
                        </button>
                      </div>
                      {compareMode && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCompare(product);
                          }}
                          className={`absolute bottom-3 right-3 rounded-lg px-3 py-2 text-xs font-semibold transition ${compared ? "bg-[#0f766e] text-white" : "bg-white/90 text-[#172e2a]"}`}
                        >
                          {compared ? "Selected" : "Compare"}
                        </button>
                      )}
                    </div>

                    <div className={view === "compact" ? "flex flex-col justify-between py-1" : "mt-4"}>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold leading-tight text-[#172e2a]">{product.title}</p>
                            <p className="mt-1 text-sm text-[#76695a]">{product.artisan}</p>
                          </div>
                          <p className="shrink-0 font-semibold text-[#172e2a]">{fmtPrice(product.price_cents)}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-[#0f766e]/10 px-2.5 py-1 font-semibold text-[#0f766e]">{product.category}</span>
                          <span className="rounded-full bg-[#8a2d3b]/10 px-2.5 py-1 font-semibold text-[#8a2d3b]">
                            {product.review_count > 0 ? `${product.avg_rating.toFixed(1)} rating` : "New"}
                          </span>
                          <span className="rounded-full bg-[#172e2a]/10 px-2.5 py-1 font-semibold text-[#172e2a]">{scaleProfile(product).label}</span>
                        </div>
                        <p className="mt-3 text-xs font-medium text-[#76695a]">{deliveryWindow(product)}</p>
                      </div>
                      <button
                        onClick={() => {
                          add(product);
                          api.recommendations.recordEvent({ eventType: "CART_ADD", productId: product.id }).catch(() => {});
                        }}
                        disabled={product.stock <= 0}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#172e2a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Icon name="bag" />
                        {product.stock > 0 ? "Add to cart" : "Out of stock"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {quickView && (
          <motion.div className="fixed inset-0 z-[95] grid place-items-center bg-black/60 px-4 py-8 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQuickView(null)}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-[#f7f3ec] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-0 md:grid-cols-[1fr_0.9fr]">
                <SmartImage src={quickView.image_url} fallbackSrc={productImageFallback(quickView)} alt={quickView.title} className="h-80 w-full object-cover md:h-full" />
                <div className="p-6 md:p-8">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f766e]">{quickView.category}</p>
                      <h2 className="mt-2 font-serif text-4xl leading-tight tracking-[-0.02em] text-[#172e2a]">{quickView.title}</h2>
                      <p className="mt-2 text-sm text-[#76695a]">{quickView.artisan}</p>
                    </div>
                    <button onClick={() => setQuickView(null)} className="grid h-11 w-11 place-items-center rounded-full border border-[#d8c8aa] text-[#5e5145] hover:bg-white">
                      ×
                    </button>
                  </div>
                  <p className="text-3xl font-semibold text-[#172e2a]">{fmtPrice(quickView.price_cents)}</p>
                  <p className="mt-5 leading-7 text-[#5e5145]">{quickView.description ?? "A curated handmade piece selected by klakoach."}</p>
                  <div className="mt-5 rounded-lg border border-[#d8c8aa] bg-white/65 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#76695a]">Care intelligence</p>
                    <p className="mt-2 text-sm leading-6 text-[#5e5145]">{careNote(quickView)}</p>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs text-[#76695a]">Fit</p>
                      <p className="mt-1 font-semibold text-[#172e2a]">{Math.round(scoreProduct(quickView))}%</p>
                    </div>
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs text-[#76695a]">Rating</p>
                      <p className="mt-1 font-semibold text-[#172e2a]">{quickView.review_count > 0 ? quickView.avg_rating.toFixed(1) : "New"}</p>
                    </div>
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs text-[#76695a]">Stock</p>
                      <p className="mt-1 font-semibold text-[#172e2a]">{quickView.stock}</p>
                    </div>
                    <div className="rounded-lg bg-white/75 p-3">
                      <p className="text-xs text-[#76695a]">Scale</p>
                      <p className="mt-1 font-semibold text-[#172e2a]">{scaleProfile(quickView).label}</p>
                    </div>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0f766e]/10 px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
                    <Icon name="truck" />
                    {deliveryWindow(quickView)}
                  </p>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => add(quickView)}
                      disabled={quickView.stock <= 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#172e2a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Icon name="bag" />
                      {quickView.stock > 0 ? "Add to cart" : "Out of stock"}
                    </button>
                    <button onClick={() => toggle(quickView.id)} className="rounded-lg border border-[#8a2d3b]/35 px-5 py-3 text-sm font-semibold text-[#8a2d3b] hover:bg-[#8a2d3b] hover:text-white">
                      {has(quickView.id) ? "Wishlisted" : "Add to wishlist"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {compareMode && compareProducts.length > 0 && (
          <motion.div 
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} 
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
            onDragEnd={(_e, info) => { if (info.offset.y > 50) setCompareIds([]); }}
            className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-5xl rounded-lg border border-[#d8c8aa] bg-[#17110d]/96 p-4 text-[#f3ead8] shadow-2xl backdrop-blur"
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold">{compareProducts.length}/3 selected for comparison</p>
              <button onClick={() => setCompareIds([])} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#d4c5a9] hover:text-white">
                Clear
              </button>
            </div>
            <div className="grid gap-3 overflow-x-auto md:grid-cols-3">
              {compareProducts.map((product) => (
                <div key={product.id} className="grid min-w-64 grid-cols-[4rem_1fr] gap-3 rounded-lg border border-white/10 bg-white/7 p-2">
                  <SmartImage src={product.image_url} fallbackSrc={productImageFallback(product)} alt={product.title} className="h-16 w-16 rounded-md object-cover" loading="eager" />
                  <div>
                    <p className="text-sm font-semibold text-white">{product.title}</p>
                    <p className="mt-1 text-xs text-[#d4c5a9]/70">{fmtPrice(product.price_cents)} · {product.review_count > 0 ? `${product.avg_rating.toFixed(1)} rating` : "New"} · {product.stock} stock</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
