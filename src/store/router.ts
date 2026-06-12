import { create } from "zustand";

const pages = [
  "home",
  "marketplace",
  "collections",
  "artisans",
  "inspiration",
  "journal",
  "about",
  "care-track-order",
  "care-returns-refunds",
  "care-shipping-info",
  "care-help-center",
  "care-faqs",
  "company-sustainability",
  "company-careers",
  "company-press",
  "account",
] as const;

export type Page = (typeof pages)[number];

type RouterState = {
  page: Page;
  navigate: (p: Page) => void;
};

function getPageFromHash(): Page {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.replace("#", "");
  return pages.includes(hash as Page) ? (hash as Page) : "home";
}

export const useRouter = create<RouterState>((set) => ({
  page: getPageFromHash(),
  navigate: (page) => {
    set({ page });
    if (typeof window !== "undefined") {
      if (page === "home") {
        if (window.location.hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
      } else if (window.location.hash !== `#${page}`) {
        window.history.pushState(null, "", `#${page}`);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    useRouter.setState({ page: getPageFromHash() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
