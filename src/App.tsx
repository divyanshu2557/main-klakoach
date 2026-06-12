import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoginModal } from "./components/LoginModal";
import { ArtisanPage } from "./components/ArtisanPage";
import { AdminPage } from "./components/AdminPage";
import { CustomerPage } from "./components/CustomerPage";
import { LandingExperience } from "./components/LandingExperience";
import { MarketplacePage } from "./components/MarketplacePage";
import { CollectionsPage } from "./components/CollectionsPage";
import { ArtisansPage } from "./components/ArtisansPage";
import { InspirationPage } from "./components/InspirationPage";
import { JournalPage } from "./components/JournalPage";
import { AboutPage } from "./components/AboutPage";
import { TrackOrderPage } from "./components/TrackOrderPage";
import { ReturnsRefundsPage } from "./components/ReturnsRefundsPage";
import { AdvancedFooterPage } from "./components/AdvancedFooterPage";
import { CartDrawer } from "./components/CartDrawer";
import { AIChatWidget } from "./components/AIChatWidget";
import { GiftFinderModal } from "./components/GiftFinderModal";
import { SearchModal } from "./components/SearchModal";
import { TopBar } from "./components/TopBar";
import { Navbar } from "./components/Navbar";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { useSession } from "./store";
import { useRouter, type Page } from "./store/router";
import { api } from "./lib/api";

const advancedPages: Page[] = [
  "care-shipping-info",
  "care-help-center",
  "care-faqs",
  "company-sustainability",
  "company-careers",
  "company-press",
];

const pageComponents: Record<string, React.ReactNode> = {
  marketplace: <MarketplacePage />,
  collections: <CollectionsPage />,
  artisans: <ArtisansPage />,
  inspiration: <InspirationPage />,
  journal: <JournalPage />,
  about: <AboutPage />,
  "care-track-order": <TrackOrderPage />,
  "care-returns-refunds": <ReturnsRefundsPage />,
  account: <CustomerPage />,
  ...Object.fromEntries(advancedPages.map((page) => [page, <AdvancedFooterPage page={page} />])),
};

export default function App() {
  const { role, clearSession } = useSession();
  const { page } = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  const handleLogout = async () => {
    await api.auth.logout().catch(() => {});
    clearSession();
  };

  // Portal pages — full screen, no public nav
  if (role === "ADMIN" || role === "admin") return <AdminPage onLogout={handleLogout} />;
  if (role === "ARTISAN" || role === "artisan") return <ArtisanPage onLogout={handleLogout} />;

  // Public multi-page layout
  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loader"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
            exit={{ 
              opacity: 0, 
              y: "-100%",
              transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
            }}
          >
            <div className="relative flex flex-col items-center max-w-[80vw]">
              {/* Logo with elegant scaling/fade in */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, filter: "blur(5px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-lg md:max-w-xl"
              >
                <img 
                  src="/loader-logo.png" 
                  alt="KlaKoach Logo" 
                  className="w-full h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.05)]"
                />
              </motion.div>

              {/* Progress Bar / Loader indicator */}
              <div className="mt-12 h-[2px] w-48 overflow-hidden rounded-full bg-[#1a1510]/10">
                <motion.div
                  className="h-full bg-linear-to-r from-[#d4a843] to-[#1a1510]"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 1.0, duration: 1 }}
                className="mt-6 text-[10px] uppercase tracking-[0.6em] text-[#1a1510]"
              >
                Handcrafted Luxury Objects
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="elite-surface min-h-screen bg-[#faf8f5] font-sans antialiased selection:bg-[#d4c5a9] selection:text-[#1a1510]">
        <TopBar />
        <Navbar onLogin={() => setLoginOpen(true)} onLogout={handleLogout} />
        <CartDrawer />
        <GiftFinderModal />
        <SearchModal />
        <AIChatWidget />
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLogin={() => setLoginOpen(false)}
        />
        
        {/* Mobile Bottom Navigation */}
        {(role !== "ADMIN" && role !== "admin" && role !== "ARTISAN" && role !== "artisan") && (
          <MobileBottomNav onLogin={() => setLoginOpen(true)} />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 18, scale: 0.992, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, scale: 0.995, filter: "blur(1.5px)" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="pb-20 sm:pb-0"
          >
            {page === "home" ? (
              <LandingExperience onLogin={() => setLoginOpen(true)} />
            ) : page === "account" && (role === "CUSTOMER" || role === "customer") ? (
              <CustomerPage />
            ) : (
              pageComponents[page] ?? <LandingExperience onLogin={() => setLoginOpen(true)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
