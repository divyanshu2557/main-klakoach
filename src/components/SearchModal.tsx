import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import { api, type Product } from "../lib/api";
import { recommendations, trending } from "../data";
import { SmartImage } from "./SmartImage";
import { useCart } from "../store";
import { useToast } from "./Toast";

type SearchStore = { open: boolean; setOpen: (v: boolean) => void };
export const useSearch = create<SearchStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const fallbackProducts: Product[] = [
  ...recommendations.map((item, i) => ({
    id: `s-${i}`, title: item.name, slug: item.name.toLowerCase().replace(/\s+/g, "-"),
    price_cents: Number(item.price.replace(/[^\d]/g, "")) * 100,
    image_url: item.image, category: "Decor", category_slug: "decor",
    artisan: item.artisan, stock: 5, avg_rating: 4.8, review_count: 20,
    created_at: new Date().toISOString(),
  })),
  ...trending.map((item, i) => ({
    id: `t-${i}`, title: item.name, slug: item.name.toLowerCase().replace(/\s+/g, "-"),
    price_cents: Number(item.price.replace(/[^\d]/g, "")) * 100,
    image_url: item.image, category: "Trending", category_slug: "trending",
    artisan: "klakoach Studio", stock: 8, avg_rating: 4.7, review_count: 15,
    created_at: new Date().toISOString(),
  })),
];

const fmt = (cents: number) => `₹ ${(cents / 100).toLocaleString("en-IN")}`;

export function SearchModal() {
  const { open, setOpen } = useSearch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { add } = useCart();
  const { add: toast } = useToast();
  const [detected, setDetected] = useState<{
    object: string;
    material: string;
    style?: string;
    colors?: string[];
    searchKeywords?: string[];
  } | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setQuery("");
      setResults([]);
      setSelected(0);
      setDetected(null);
      setInStockOnly(false);
      setMinRating(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      if (!detected) setResults([]);
      return;
    }
    setLoading(true);
    setDetected(null);
    const timer = setTimeout(() => {
      api.products.list({ search: query, limit: 8, inStock: inStockOnly ? "true" : undefined, minRating: minRating > 0 ? minRating : undefined })
        .then((d) => {
          const list = d.products.length ? d.products : fallbackProducts.filter((p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.artisan.toLowerCase().includes(query.toLowerCase())
          );
          setResults(list.slice(0, 8));
        })
        .catch(() => {
          setResults(fallbackProducts.filter((p) =>
            p.title.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 8));
        })
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setDetected(null);
    setQuery("");
    try {
      const res = await api.ai.visualSearch(file);
      setDetected(res.detected);
      setResults(res.products);
      toast(`✦ AI visual search: detected ${res.detected.object}`);
    } catch {
      toast("Image search failed", "error");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (!open) return;
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, results.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && results[selected]) {
        add(results[selected]);
        toast(`${results[selected].title} added to cart`);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected]);

  const trending_terms = ["Terracotta", "Macrame", "Brass Bowl", "Rattan Lamp", "Linen Throw"];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-[#1a1510]/90 backdrop-blur-2xl"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.22 }}
            className="mx-auto max-w-2xl px-4 pt-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <svg className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#d4c5a9]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Search products, artisans, materials…"
                className="h-16 w-full rounded-2xl border border-[#d4c5a9]/15 bg-[#2a2218] pl-14 pr-16 text-lg text-[#e8dcc4] outline-none placeholder:text-[#d4c5a9]/30 focus:border-[#d4c5a9]/30"
              />
              <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                {loading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4c5a9]/20 border-t-[#d4a843]" />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d4c5a9]/10 bg-white/[0.03] text-[#d4c5a9]/60 transition hover:border-[#d4c5a9]/30 hover:bg-white/[0.08] hover:text-[#e8dcc4]"
                  title="Search by image (AI)"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12.75a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5h.008v.008H19.5V10.5z" />
                  </svg>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setInStockOnly((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition border ${inStockOnly ? "border-[#d4a843] bg-[#d4a843] text-[#1a1510]" : "border-[#d4c5a9]/15 bg-[#2a2218] text-[#d4c5a9]/60 hover:text-[#e8dcc4]"}`}
              >
                In stock only
              </button>
              <button
                onClick={() => setMinRating((v) => (v > 0 ? 0 : 4.5))}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition border ${minRating > 0 ? "border-[#d4a843] bg-[#d4a843] text-[#1a1510]" : "border-[#d4c5a9]/15 bg-[#2a2218] text-[#d4c5a9]/60 hover:text-[#e8dcc4]"}`}
              >
                4.5+ rating
              </button>
            </div>

            {detected && (
              <div className="mt-4 rounded-2xl border border-[#d4a843]/20 bg-[#d4a843]/5 p-4 text-[#e8dcc4]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#d4a843]" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#d4a843]">✦ AI Visual Search Analysis</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#2a2218] border border-[#d4c5a9]/15 px-3 py-1 text-xs text-[#d4c5a9]">
                    Detected: <strong className="text-white">{detected.object}</strong>
                  </span>
                  <span className="rounded-full bg-[#2a2218] border border-[#d4c5a9]/15 px-3 py-1 text-xs text-[#d4c5a9]">
                    Material: <strong className="text-white">{detected.material}</strong>
                  </span>
                  {detected.style && (
                    <span className="rounded-full bg-[#2a2218] border border-[#d4c5a9]/15 px-3 py-1 text-xs text-[#d4c5a9]">
                      Style: <strong className="text-white">{detected.style}</strong>
                    </span>
                  )}
                </div>
                {detected.searchKeywords && detected.searchKeywords.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-[#d4c5a9]/40 uppercase tracking-widest mr-1.5">Keywords:</span>
                    {detected.searchKeywords.map((kw) => (
                      <span key={kw} className="text-xs text-[#d4c5a9]/80 bg-[#2a2218]/40 px-2 py-0.5 rounded-md">
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!query && !detected && (
              <div className="mt-6">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[#d4c5a9]/30">Trending searches</p>
                <div className="flex flex-wrap gap-2">
                  {trending_terms.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="rounded-full border border-[#d4c5a9]/15 bg-[#2a2218] px-4 py-2 text-sm text-[#d4c5a9]/60 transition hover:border-[#d4c5a9]/30 hover:text-[#e8dcc4]"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#d4c5a9]/10 bg-[#1a1510]">
                {results.map((product, i) => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-4 px-5 py-3 transition cursor-pointer ${i === selected ? "bg-[#d4c5a9]/10" : "hover:bg-[#d4c5a9]/5"} ${i > 0 ? "border-t border-[#d4c5a9]/8" : ""}`}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => { add(product); toast(`${product.title} added to cart`); setOpen(false); }}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                      <SmartImage src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[#e8dcc4]">{product.title}</p>
                      <p className="text-xs text-[#d4c5a9]/40">{product.artisan} · {product.category}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#d4c5a9]">{fmt(product.price_cents)}</p>
                  </div>
                ))}
                <div className="border-t border-[#d4c5a9]/8 px-5 py-3">
                  <p className="text-xs text-[#d4c5a9]/30">↵ Enter to add to cart · ↑↓ Navigate · Esc Close</p>
                </div>
              </div>
            )}

            {query && !loading && results.length === 0 && (
              <div className="mt-8 text-center">
                <p className="text-[#d4c5a9]/40">No results for "{query}"</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
