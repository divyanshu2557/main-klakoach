import { motion } from "framer-motion";
import { useCart, useSession } from "../store";
import { useRouter } from "../store/router";
import { useSearch } from "./SearchModal";

export function MobileBottomNav({ onLogin }: { onLogin: () => void }) {
  const { items, setOpen: setCartOpen } = useCart();
  const { page, navigate } = useRouter();
  const { role } = useSession();
  const { setOpen: setSearchOpen } = useSearch();

  const cartCount = items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
      action: () => navigate("home"),
      isActive: page === "home",
    },
    {
      id: "search",
      label: "Search",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      action: () => setSearchOpen(true),
      isActive: false,
    },
    {
      id: "marketplace",
      label: "Shop",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
        </svg>
      ),
      action: () => navigate("marketplace"),
      isActive: page === "marketplace",
    },
    {
      id: "cart",
      label: "Cart",
      icon: (
        <div className="relative">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2 grid h-4 w-4 place-items-center rounded-full bg-[#8a2d3b] text-[9px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </div>
      ),
      action: () => setCartOpen(true),
      isActive: false,
    },
    {
      id: "account",
      label: "Account",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      action: () => {
        if (role === "CUSTOMER" || role === "customer") {
          navigate("account");
        } else {
          onLogin();
        }
      },
      isActive: page === "account",
    },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-[60] block sm:hidden bg-[#1a1510]/95 backdrop-blur-2xl border-t border-[#d4c5a9]/10 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
      >
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl p-2 transition-colors active:scale-95 ${
                item.isActive ? "text-[#e8dcc4]" : "text-[#d4c5a9]/50 hover:text-[#d4c5a9]"
              }`}
            >
              {item.icon}
              <span className={`text-[10px] font-medium tracking-wide ${item.isActive ? "text-[#e8dcc4]" : "text-[#d4c5a9]/50"}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </motion.nav>
    </>
  );
}
