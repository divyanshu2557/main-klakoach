import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, useWishlist, useFilterStore, useSession } from "../store";
import { useRouter, type Page } from "../store/router";
import { SmartImage } from "./SmartImage";
import { useSearch } from "./SearchModal";
import { useGiftFinder } from "./GiftFinderModal";
import { useSSE } from "../store/sse";
import { api } from "../lib/api";

type NavLink = {
  label: string;
  page: Page;
  preview: { image: string; caption: string };
};

const navLinks: NavLink[] = [
  {
    label: "Marketplace",
    page: "marketplace",
    preview: { image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80", caption: "10,000+ handcrafted pieces" },
  },
  {
    label: "Collections",
    page: "collections",
    preview: { image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80", caption: "Curated worlds of craft" },
  },
  {
    label: "Artisans",
    page: "artisans",
    preview: { image: "https://images.unsplash.com/photo-1595351298020-038700609878?auto=format&fit=crop&w=600&q=80", caption: "500+ verified makers" },
  },
  {
    label: "Inspiration",
    page: "inspiration",
    preview: { image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80", caption: "Room ideas & mood boards" },
  },
  {
    label: "Journal",
    page: "journal",
    preview: { image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?auto=format&fit=crop&w=600&q=80", caption: "Stories of craft & culture" },
  },
  {
    label: "About",
    page: "about",
    preview: { image: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=600&q=80", caption: "Our mission & team" },
  },
];

export function Navbar({ onLogin, onLogout }: { onLogin: () => void; onLogout: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState<Page | null>(null);
  const { items, setOpen } = useCart();
  const { ids } = useWishlist();
  const { page, navigate } = useRouter();
  const { setOpen: setSearchOpen } = useSearch();
  const { setOpen: setGiftFinderOpen } = useGiftFinder();
  const cartCount = items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);
  const wishlistCount = ids.size;
  const { token, role } = useSession();
  const { unreadCount, notifications, markRead } = useSSE();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<{name: string, email: string} | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (token && (role === "CUSTOMER" || role === "customer")) {
      api.customer.profile().then(setProfile).catch(() => setProfile(null));
    }
  }, [token, role]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hoveredLink = navLinks.find((l) => l.page === hovered);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-[#1a1510]/95 shadow-2xl shadow-black/20 backdrop-blur-2xl" : "bg-[#1a1510]"
        }`}
        onMouseLeave={() => setHovered(null)}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:py-5">
          {/* Logo */}
          <button onClick={() => navigate("home")} className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2 sm:mr-4 lg:mr-8">
            <img src="/logo.png" alt="KlaKoach Logo" className="h-8 w-8 sm:h-10 sm:w-10 object-contain drop-shadow-md brightness-110" />
            <div className="hidden min-[400px]:block">
              <span className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#e8dcc4]">klakoach</span>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden flex-1 justify-center items-center gap-1 lg:flex overflow-hidden">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => { navigate(link.page); setHovered(null); }}
                onMouseEnter={() => setHovered(link.page)}
                className={`group relative px-2 lg:px-3 xl:px-4 py-2 text-[13px] font-medium tracking-wide transition-colors duration-300 shrink-0 ${
                  page === link.page ? "text-[#e8dcc4]" : "text-[#d4c5a9]/70 hover:text-[#e8dcc4]"
                }`}
              >
                {link.label}
                <span className={`absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-[#d4a843] transition-all duration-300 ${
                  page === link.page ? "w-5" : "w-0 group-hover:w-5"
                }`} />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2 shrink-0">
            {/* Search button with keyboard hint */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-[#d4c5a9]/15 bg-[#d4c5a9]/5 px-4 py-2 text-[13px] text-[#d4c5a9]/50 transition hover:border-[#d4c5a9]/30 hover:text-[#d4c5a9]/80 sm:flex"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span>Search</span>
              <kbd className="rounded border border-[#d4c5a9]/15 px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
            </button>

            <button
              onClick={() => setGiftFinderOpen(true)}
              className="hidden items-center gap-2 rounded-full border border-[#d4c5a9]/15 bg-[#d4a843]/10 px-4 py-2 text-[13px] text-[#e8dcc4] transition hover:border-[#d4a843]/40 hover:bg-[#d4a843]/15 hover:text-white sm:flex"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 11l-5.6 1.4L12 18l-1.9-5.6L4.5 11l5.6-2.4L12 3z" />
              </svg>
              <span>Gift Finder</span>
            </button>



            <button
              onClick={() => setGiftFinderOpen(true)}
              className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-[#d4c5a9]/60 transition-colors hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4] sm:hidden"
              aria-label="Open gift finder"
            >
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6L19.5 11l-5.6 1.4L12 18l-1.9-5.6L4.5 11l5.6-2.4L12 3z" />
              </svg>
            </button>

            {/* Wishlist */}
            <button
              onClick={() => {
                useFilterStore.getState().setWishlistOnly(true);
                navigate("marketplace");
              }}
              className="hidden sm:grid relative h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-[#d4c5a9]/60 transition-colors hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4]"
            >
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute right-0 top-0 sm:right-1 sm:top-1 grid h-3.5 w-3.5 sm:h-4 sm:w-4 place-items-center rounded-full bg-[#8a2d3b] text-[8px] sm:text-[9px] font-bold text-white">{wishlistCount}</span>
              )}
            </button>

            {/* Notifications */}
            {token && (
              <div className="hidden sm:block relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative grid h-10 w-10 place-items-center rounded-full text-[#d4c5a9]/60 transition-colors hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4]"
                  aria-label="Notifications"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#d44843] text-[9px] font-bold text-white animate-pulse">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-[#d4c5a9]/15 bg-[#1a1510]/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-[#d4c5a9]/10">
                        <p className="text-sm font-medium text-[#e8dcc4]">Notifications</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-4 py-6 text-center text-xs text-[#d4c5a9]/40">No notifications yet</p>
                        ) : (
                          notifications.slice(0, 10).map((n) => (
                            <button
                              key={n.id}
                              onClick={() => { markRead(n.id); api.studio.markRead(n.id).catch(() => {}); }}
                              className={`w-full px-4 py-3 text-left border-b border-[#d4c5a9]/5 transition hover:bg-[#d4c5a9]/5 ${!n.read_at ? 'bg-[#d4a843]/5' : ''}`}
                            >
                              <p className="text-xs font-medium text-[#e8dcc4]">{n.title}</p>
                              <p className="text-[10px] text-[#d4c5a9]/50 mt-0.5 line-clamp-2">{n.body}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Cart */}
            <button onClick={() => setOpen(true)} className="hidden sm:grid relative h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-[#d4c5a9]/60 transition-colors hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4]">
              <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute right-0 top-0 sm:right-1 sm:top-1 grid h-3.5 w-3.5 sm:h-4 sm:w-4 place-items-center rounded-full bg-[#d4a843] text-[8px] sm:text-[9px] font-bold text-[#1a1510]">{cartCount}</span>
              )}
            </button>

            <div className="mx-2 hidden h-6 w-px bg-[#d4c5a9]/15 sm:block" />

            {role === "CUSTOMER" || role === "customer" ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="hidden items-center gap-2 rounded-full border border-[#d4c5a9]/25 px-5 py-2.5 text-[13px] font-medium tracking-wide text-[#e8dcc4] transition-all duration-300 hover:border-[#d4a843] hover:bg-[#d4a843]/10 sm:flex"
                >
                  <span className="truncate max-w-[120px]">{profile?.name || profile?.email || "Account"}</span>
                  <svg className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-[#d4c5a9]/15 bg-[#1a1510]/98 backdrop-blur-2xl shadow-2xl overflow-hidden py-2"
                    >
                      <button onClick={() => { navigate("account"); setUserMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-[#e8dcc4] hover:bg-[#d4c5a9]/10 transition-colors">My Account</button>
                      <div className="my-2 border-t border-[#d4c5a9]/10" />
                      <button onClick={() => { onLogout(); setUserMenuOpen(false); }} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-400/10 transition-colors">Sign Out</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="hidden items-center gap-2 rounded-full border border-[#d4c5a9]/25 px-5 py-2.5 text-[13px] font-medium tracking-wide text-[#e8dcc4] transition-all duration-300 hover:border-[#d4a843] hover:bg-[#d4a843]/10 sm:flex"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Sign In
              </button>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full text-[#d4c5a9]/60 transition-colors hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4] lg:hidden"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mega-menu hover preview */}
        <AnimatePresence>
          {hovered && hoveredLink && (
            <motion.div
              key={hovered}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 border-t border-[#d4c5a9]/10 bg-[#1a1510]/98 backdrop-blur-2xl shadow-2xl"
            >
              <div className="mx-auto flex max-w-7xl items-center gap-10 px-6 py-6">
                <div className="h-32 w-52 shrink-0 overflow-hidden rounded-xl">
                  <SmartImage src={hoveredLink.preview.image} alt={hoveredLink.label} className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5a9]/40 mb-2">{hoveredLink.label}</p>
                  <p className="font-serif text-2xl text-[#e8dcc4]">{hoveredLink.preview.caption}</p>
                  <button
                    onClick={() => { navigate(hoveredLink.page); setHovered(null); }}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-[#d4a843] hover:text-[#e8dcc4] transition-colors"
                  >
                    Explore {hoveredLink.label} →
                  </button>
                </div>
                <div className="ml-auto hidden lg:flex flex-col gap-2">
                  {navLinks.filter((l) => l.page !== hovered).slice(0, 3).map((l) => (
                    <button
                      key={l.page}
                      onClick={() => { navigate(l.page); setHovered(null); }}
                      className="text-right text-sm text-[#d4c5a9]/40 hover:text-[#d4c5a9]/80 transition-colors"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-[#d4c5a9]/10 bg-[#1a1510] px-6 pb-6 lg:hidden max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              <div className="flex flex-col gap-1 pt-4">
                {navLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => { navigate(link.page); setMobileOpen(false); }}
                    className={`flex items-center gap-4 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                      page === link.page ? "bg-[#d4c5a9]/10 text-[#e8dcc4]" : "text-[#d4c5a9]/70 hover:bg-[#d4c5a9]/10 hover:text-[#e8dcc4]"
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <SmartImage src={link.preview.image} alt={link.label} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p>{link.label}</p>
                      <p className="text-[10px] text-[#d4c5a9]/35">{link.preview.caption}</p>
                    </div>
                  </button>
                ))}
                <div className="mt-4 border-t border-[#d4c5a9]/10 pt-4">
                  {role === "CUSTOMER" || role === "customer" ? (
                    <>
                      <button onClick={() => { navigate("account"); setMobileOpen(false); }} className="w-full rounded-full border border-[#d4c5a9]/20 py-3 text-sm font-semibold text-[#e8dcc4] mb-2 transition-colors hover:bg-[#d4c5a9]/10">My Account</button>
                      <button onClick={() => { onLogout(); setMobileOpen(false); }} className="w-full rounded-full bg-[#d4c5a9] py-3 text-sm font-semibold text-[#1a1510] transition-colors hover:bg-[#e8dcc4]">Sign Out</button>
                    </>
                  ) : (
                    <button
                      onClick={() => { onLogin(); setMobileOpen(false); }}
                      className="w-full rounded-full bg-[#d4c5a9] py-3 text-sm font-semibold text-[#1a1510] transition-colors hover:bg-[#e8dcc4]"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
    </>
  );
}
