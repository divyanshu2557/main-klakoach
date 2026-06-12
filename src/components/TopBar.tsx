const offers = [
  "✦ Free Shipping Above ₹1999",
  "✦ Easy 30-Day Returns",
  "✦ Secure Payments",
  "✦ 500+ Verified Artisans",
  "✦ Handcrafted with Soul",
  "✦ New Arrivals Every Week",
];

export function TopBar() {

  return (
    <div className="border-b border-[#d4c5a9]/10 bg-[#1a1510] overflow-hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        {/* Marquee */}
        <div className="flex-1 overflow-hidden mr-6">
          <div className="flex animate-[marquee_28s_linear_infinite] whitespace-nowrap gap-10">
            {[...offers, ...offers].map((offer, i) => (
              <span key={i} className="text-[11px] tracking-wide text-[#d4c5a9]/60 shrink-0">
                <span className="text-[#d4a843]">✦</span> {offer.replace("✦ ", "")}
              </span>
            ))}
          </div>
        </div>

        {/* Right actions */}
        <div className="hidden items-center gap-4 text-[11px] tracking-wide text-[#d4c5a9]/60 md:flex shrink-0">
          <a href="#" className="transition hover:text-[#d4c5a9]">Track Order</a>
          <span className="text-[#d4c5a9]/20">|</span>
          <a href="#" className="transition hover:text-[#d4c5a9]">Help Center</a>
          <span className="text-[#d4c5a9]/20">|</span>
          <button className="flex items-center gap-1 transition hover:text-[#d4c5a9]">
            🇮🇳 India (INR)
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
