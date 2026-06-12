import { motion } from "framer-motion";
import { type Page } from "../store/router";
import { SmartImage } from "./SmartImage";

type Item = {
  title: string;
  body: string;
  metric: string;
};

type FooterPageConfig = {
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  action: string;
  highlights: Item[];
  modules: Item[];
};

const pageConfig: Record<string, FooterPageConfig> = {
  "shop-all-products": {
    eyebrow: "Shop",
    title: "All Products",
    subtitle: "Browse the full handcrafted catalog with live stock, quality signals, and personalized fit scoring.",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=2200&q=84",
    action: "Launch Smart Catalog",
    highlights: [
      { title: "Live Catalog", body: "Every SKU includes stock depth, artisan profile, and rating confidence.", metric: "50K+" },
      { title: "Instant Filters", body: "Material, room, budget, and delivery speed filters update in real time.", metric: "<120ms" },
      { title: "Trust Layer", body: "Each item shows verification, return policy, and fulfillment reliability.", metric: "99.2%" },
    ],
    modules: [
      { title: "AI Fit Engine", body: "Ranks products against your room and mood profile.", metric: "4 signals" },
      { title: "Price Intelligence", body: "Compares handcrafted value by material and artisan history.", metric: "Daily" },
      { title: "Fast Checkout", body: "One-click bundle checkout with secure payment orchestration.", metric: "2 steps" },
    ],
  },
  "shop-new-arrivals": {
    eyebrow: "Shop",
    title: "New Arrivals",
    subtitle: "Track newly launched craft pieces with priority discovery and early-access purchase windows.",
    image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=2200&q=84",
    action: "View New Drops",
    highlights: [
      { title: "Drop Radar", body: "Fresh arrivals are grouped by style and category for quick review.", metric: "Daily" },
      { title: "Early Access", body: "Limited editions are surfaced before they trend on the marketplace.", metric: "48h" },
      { title: "Launch Notes", body: "Understand origin story, material process, and artisan signature.", metric: "100%" },
    ],
    modules: [
      { title: "Release Calendar", body: "Plan upcoming drops across all active makers.", metric: "Weekly" },
      { title: "Smart Alerts", body: "Receive updates for chosen categories and budget bands.", metric: "Realtime" },
      { title: "Reserve Queue", body: "Hold high-demand pieces during checkout handoff.", metric: "5 min" },
    ],
  },
  "shop-best-sellers": {
    eyebrow: "Shop",
    title: "Best Sellers",
    subtitle: "A high-confidence list of products customers repeatedly buy, review, and recommend.",
    image: "https://images.unsplash.com/photo-1515669097368-22e68427d265?auto=format&fit=crop&w=2200&q=84",
    action: "Open Top Picks",
    highlights: [
      { title: "Demand Score", body: "Blends orders, repeat purchases, and wishlist acceleration.", metric: "3x" },
      { title: "Quality Proof", body: "Surfaces pieces with sustained rating and low return ratio.", metric: "4.8+" },
      { title: "Fast Ship", body: "Prioritizes products with healthy stock and stable logistics.", metric: "2-4d" },
    ],
    modules: [
      { title: "Trend Decoder", body: "Explains why an item is climbing in demand.", metric: "Hourly" },
      { title: "Region Heatmap", body: "Shows where each bestseller is peaking.", metric: "25+ markets" },
      { title: "Bundle Optimizer", body: "Builds room-ready combos from top performers.", metric: "1 click" },
    ],
  },
  "shop-gift-ideas": {
    eyebrow: "Shop",
    title: "Gift Ideas",
    subtitle: "Curated gifting collections with recipient fit, occasion logic, and packaging guidance.",
    image: "https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=2200&q=84",
    action: "Explore Gift Studio",
    highlights: [
      { title: "Occasion Engine", body: "Birthday, wedding, housewarming, and festival gift tracks.", metric: "12 types" },
      { title: "Recipient Fit", body: "Matches items by taste profile and home context.", metric: "AI" },
      { title: "Gift Ready", body: "Premium wrap options and personalized artisan note support.", metric: "24h prep" },
    ],
    modules: [
      { title: "Budget Bands", body: "Auto groups gift options by spend thresholds.", metric: "5 tiers" },
      { title: "Delivery Promise", body: "Filters only items that reach before event date.", metric: "Date-safe" },
      { title: "Multi-Ship", body: "Checkout multiple recipients in one flow.", metric: "Batch" },
    ],
  },
  "shop-sale": {
    eyebrow: "Shop",
    title: "Sale",
    subtitle: "Premium markdowns with transparent pricing history and verified inventory status.",
    image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=2200&q=84",
    action: "Open Sale Grid",
    highlights: [
      { title: "Price History", body: "Track markdown integrity across campaign windows.", metric: "30 days" },
      { title: "True Savings", body: "See effective savings after shipping and tax context.", metric: "Up to 45%" },
      { title: "Last Chance", body: "Flag products with low stock and expiring offers.", metric: "Live" },
    ],
    modules: [
      { title: "Deal Scanner", body: "Highlights strongest value across categories.", metric: "Ranked" },
      { title: "Flash Queue", body: "Priority access to limited-duration drops.", metric: "Minutes" },
      { title: "Price Alerts", body: "Notifies when watched products cross your threshold.", metric: "Realtime" },
    ],
  },
  "collection-home-decor": {
    eyebrow: "Collections",
    title: "Home Decor",
    subtitle: "A complete decor intelligence layer for styling every zone of your home with confidence.",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=2200&q=84",
    action: "Open Decor Collection",
    highlights: [
      { title: "Room Models", body: "Living, dining, and entry compositions with balanced scale.", metric: "16 presets" },
      { title: "Palette Sync", body: "Suggests pieces that align with your existing color profile.", metric: "Auto" },
      { title: "Stacked Layers", body: "Combines focal, supporting, and accent objects smartly.", metric: "3 layers" },
    ],
    modules: [
      { title: "Style Maps", body: "Explore calm, earthy, minimal, and luxe paths.", metric: "8 themes" },
      { title: "Placement Guide", body: "Recommended spacing and surface hierarchy.", metric: "Pro" },
      { title: "Mood Preview", body: "Preview curated sets before purchase.", metric: "Interactive" },
    ],
  },
  "collection-wall-decor": {
    eyebrow: "Collections",
    title: "Wall Decor",
    subtitle: "Scale-aware wall curation with spacing, composition, and visual balance built in.",
    image: "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=2200&q=84",
    action: "Design Wall Setup",
    highlights: [
      { title: "Grid Composer", body: "Assemble galleries by ratio, gap, and narrative flow.", metric: "Drag-drop" },
      { title: "Size Logic", body: "Recommends piece dimensions from wall measurements.", metric: "Auto-fit" },
      { title: "Finish Matching", body: "Aligns frame/material finish with room accents.", metric: "Smart" },
    ],
    modules: [
      { title: "Height Rules", body: "Hanging guidelines for visual comfort and impact.", metric: "Exact" },
      { title: "Pairing Engine", body: "Mixes mirrors, art, and textile walls cleanly.", metric: "Balanced" },
      { title: "Batch Save", body: "Save complete wall boards for later purchase.", metric: "1 click" },
    ],
  },
  "collection-table-decor": {
    eyebrow: "Collections",
    title: "Table Decor",
    subtitle: "Centerpiece planning and layered table styling for everyday and occasion setups.",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=2200&q=84",
    action: "Build Table Scene",
    highlights: [
      { title: "Centerpiece Studio", body: "Shape focal arrangements by table size.", metric: "3 scales" },
      { title: "Material Rhythm", body: "Blend ceramic, wood, and brass without visual clutter.", metric: "Guided" },
      { title: "Event Modes", body: "Switch between daily, festive, and hosting presets.", metric: "1 tap" },
    ],
    modules: [
      { title: "Serving Flow", body: "Layout order based on function and movement.", metric: "Optimized" },
      { title: "Scene Packs", body: "Prebuilt looks by tone and season.", metric: "24 packs" },
      { title: "Care Layers", body: "Per-item cleaning and storage instructions.", metric: "Built-in" },
    ],
  },
  "collection-lighting": {
    eyebrow: "Collections",
    title: "Lighting",
    subtitle: "Ambient intelligence for layered lighting plans with material-sensitive recommendations.",
    image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=2200&q=84",
    action: "Plan Lighting",
    highlights: [
      { title: "Layer Control", body: "Balance task, ambient, and accent lighting.", metric: "3 channels" },
      { title: "Brightness Map", body: "Choose luminosity levels by room purpose.", metric: "Adaptive" },
      { title: "Fixture Fit", body: "Match pendant and lamp scale to geometry.", metric: "Auto" },
    ],
    modules: [
      { title: "Warmth Profiles", body: "Curated Kelvin presets for mood control.", metric: "5 presets" },
      { title: "Placement Grid", body: "Install guides for even light distribution.", metric: "Precise" },
      { title: "Energy Lens", body: "Estimate power and lifetime efficiency.", metric: "Forecast" },
    ],
  },
  "collection-textiles": {
    eyebrow: "Collections",
    title: "Textiles",
    subtitle: "Texture-driven curation for throws, rugs, cushions, and layered softness across spaces.",
    image: "https://images.unsplash.com/photo-1616627561839-074385245ff6?auto=format&fit=crop&w=2200&q=84",
    action: "Open Textile Lab",
    highlights: [
      { title: "Texture Stack", body: "Coordinate weave depth and softness by room use.", metric: "Smart" },
      { title: "Color Pairing", body: "Build calm or contrast sets with confidence.", metric: "Auto" },
      { title: "Durability Scores", body: "See wear profile for daily, family, or guest use.", metric: "Rated" },
    ],
    modules: [
      { title: "Season Switch", body: "Rotate textile sets by weather and tone.", metric: "Quarterly" },
      { title: "Layer Packs", body: "Pre-matched rug, throw, and cushion bundles.", metric: "Curated" },
      { title: "Care Matrix", body: "Wash and maintenance guidance by fabric type.", metric: "Detailed" },
    ],
  },
  "collection-planters": {
    eyebrow: "Collections",
    title: "Planters",
    subtitle: "Green-space decor planning with planter scale, drainage fit, and sunlight compatibility.",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=2200&q=84",
    action: "Start Green Layout",
    highlights: [
      { title: "Plant Fit", body: "Match vessel size and shape to plant growth profile.", metric: "Guided" },
      { title: "Zone Planner", body: "Build indoor and outdoor planter compositions.", metric: "2 modes" },
      { title: "Drainage Safety", body: "Flags correct drainage and liner setup.", metric: "Verified" },
    ],
    modules: [
      { title: "Sunlight Map", body: "Suggest placement by natural light quality.", metric: "Room-wise" },
      { title: "Material Match", body: "Choose ceramic, stone, or metal by climate.", metric: "Contextual" },
      { title: "Maintenance Flow", body: "Care reminders for watering and rotation.", metric: "Weekly" },
    ],
  },
  "care-track-order": {
    eyebrow: "Customer Care",
    title: "Track Order",
    subtitle: "Real-time order observability from payment to delivery with milestone-level transparency.",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=2200&q=84",
    action: "Track Live Orders",
    highlights: [
      { title: "Live Status", body: "See current stage, handoff point, and ETA confidence.", metric: "Realtime" },
      { title: "Exception Alerts", body: "Instant updates on delays or routing exceptions.", metric: "<30s" },
      { title: "Delivery Window", body: "Refined ETA based on courier performance.", metric: "Dynamic" },
    ],
    modules: [
      { title: "Shipment Timeline", body: "All milestone events in one scroll.", metric: "Complete" },
      { title: "Proof of Delivery", body: "Photo/signature verification workflow.", metric: "Secure" },
      { title: "Support Handoff", body: "Open issue with prefilled order context.", metric: "Fast" },
    ],
  },
  "care-returns-refunds": {
    eyebrow: "Customer Care",
    title: "Returns & Refunds",
    subtitle: "Policy-backed return workflows with clear eligibility and fast refund tracking.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=2200&q=84",
    action: "Start Return Flow",
    highlights: [
      { title: "Eligibility Check", body: "Instant validation by item category and return window.", metric: "Auto" },
      { title: "Refund Visibility", body: "Track initiated, approved, and settled stages clearly.", metric: "3 phases" },
      { title: "Pickup Scheduler", body: "Select preferred pickup date and slot.", metric: "Flexible" },
    ],
    modules: [
      { title: "Return Reasons", body: "Structured reasons accelerate resolution.", metric: "Guided" },
      { title: "Quality Evidence", body: "Upload issue media with context fields.", metric: "Rich" },
      { title: "Resolution Paths", body: "Exchange, credit, or refund options.", metric: "3 options" },
    ],
  },
  "care-shipping-info": {
    eyebrow: "Customer Care",
    title: "Shipping Info",
    subtitle: "Transparent logistics intelligence for rates, zones, and delivery reliability.",
    image: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=2200&q=84",
    action: "View Shipping Matrix",
    highlights: [
      { title: "Zone Pricing", body: "Shipping charges by region and order composition.", metric: "Global" },
      { title: "Carrier Quality", body: "Reliability score by partner and lane.", metric: "Rated" },
      { title: "Packaging Class", body: "Protective handling level by item fragility.", metric: "Tiered" },
    ],
    modules: [
      { title: "Speed Tiers", body: "Standard, priority, and insured delivery modes.", metric: "3 tiers" },
      { title: "Address Validation", body: "Detects risky or incomplete addresses early.", metric: "Live" },
      { title: "Tax & Duties", body: "Previews duties for cross-border orders.", metric: "Transparent" },
    ],
  },
  "care-help-center": {
    eyebrow: "Customer Care",
    title: "Help Center",
    subtitle: "A full-service support gateway with guided diagnostics and direct specialist access.",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=2200&q=84",
    action: "Open Support Hub",
    highlights: [
      { title: "Issue Triage", body: "Guided support flows identify root causes quickly.", metric: "Smart" },
      { title: "Context-Aware Chat", body: "Support sees order and product context instantly.", metric: "Integrated" },
      { title: "Priority Escalation", body: "Critical issues route to senior support lanes.", metric: "24/7" },
    ],
    modules: [
      { title: "Knowledge Base", body: "Searchable fixes and process docs.", metric: "500+ articles" },
      { title: "Case Timeline", body: "Track every update and agent action.", metric: "Auditable" },
      { title: "Resolution SLA", body: "Visibility into target response windows.", metric: "<4h" },
    ],
  },
  "care-faqs": {
    eyebrow: "Customer Care",
    title: "FAQs",
    subtitle: "Fast answers to high-volume customer questions across products, logistics, and policies.",
    image: "https://images.unsplash.com/photo-1560732488-6b0df240254a?auto=format&fit=crop&w=2200&q=84",
    action: "Browse FAQs",
    highlights: [
      { title: "Top Questions", body: "Most asked questions ranked by current demand.", metric: "Live" },
      { title: "Answer Quality", body: "Responses maintained and verified by operations.", metric: "Weekly" },
      { title: "Direct Actions", body: "Jump from answer to relevant support flow.", metric: "1 click" },
    ],
    modules: [
      { title: "Category Filters", body: "Find answers by topic quickly.", metric: "8 groups" },
      { title: "Rich Guides", body: "Step-by-step paths for complex issues.", metric: "Detailed" },
      { title: "Feedback Loop", body: "Rate answer usefulness for continuous improvement.", metric: "Adaptive" },
    ],
  },
  "company-about-us": {
    eyebrow: "Company",
    title: "About Us",
    subtitle: "Learn how klakoach blends technology and craftsmanship to build a trusted global marketplace.",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=84",
    action: "Explore Company Story",
    highlights: [
      { title: "Mission Focus", body: "Enable artisans to scale without losing authenticity.", metric: "Core" },
      { title: "Platform Reach", body: "Customers and makers connected across markets.", metric: "25+ countries" },
      { title: "Craft Integrity", body: "Verification and curation workflows protect quality.", metric: "Strict" },
    ],
    modules: [
      { title: "Leadership", body: "Meet operators building product and marketplace trust.", metric: "Cross-functional" },
      { title: "Roadmap", body: "See near-term priorities for the platform.", metric: "Transparent" },
      { title: "Impact", body: "Track artisan income and customer outcomes.", metric: "Measured" },
    ],
  },
  "company-our-artisans": {
    eyebrow: "Company",
    title: "Our Artisans",
    subtitle: "Profiles, studios, and craft lineages of the makers who define the marketplace.",
    image: "https://images.unsplash.com/photo-1455849318743-b2233052fcff?auto=format&fit=crop&w=2200&q=84",
    action: "Meet All Artisans",
    highlights: [
      { title: "Verified Makers", body: "Every artisan profile is checked for authenticity and quality.", metric: "500+" },
      { title: "Craft Depth", body: "Category and skill mapping across ceramics, textiles, and more.", metric: "12 crafts" },
      { title: "Studio Stories", body: "See method, material, and heritage for each maker.", metric: "Rich profile" },
    ],
    modules: [
      { title: "Follower Graph", body: "Discover top makers and rising talent.", metric: "Realtime" },
      { title: "Studio Analytics", body: "Operational insights for artisan growth.", metric: "Advanced" },
      { title: "Direct Support", body: "Customers can follow and support favorite makers.", metric: "Built-in" },
    ],
  },
  "company-sustainability": {
    eyebrow: "Company",
    title: "Sustainability",
    subtitle: "Material-first sustainability programs tracked with measurable impact indicators.",
    image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2200&q=84",
    action: "View Sustainability Report",
    highlights: [
      { title: "Responsible Sourcing", body: "Preference for low-impact and traceable materials.", metric: "Priority" },
      { title: "Packaging Standard", body: "Reduced-plastic and protective eco-packaging flow.", metric: "95%" },
      { title: "Lifecycle Lens", body: "Durability and care guidance extends product life.", metric: "+2.4y" },
    ],
    modules: [
      { title: "Impact Dashboard", body: "Track waste, transport, and packaging metrics.", metric: "Live" },
      { title: "Maker Education", body: "Programs for sustainable process upgrades.", metric: "Ongoing" },
      { title: "Audit Trails", body: "Maintain accountable sourcing records.", metric: "Verified" },
    ],
  },
  "company-careers": {
    eyebrow: "Company",
    title: "Careers",
    subtitle: "Build commerce, design, and operations systems that elevate artisan-led global retail.",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=2200&q=84",
    action: "Browse Open Roles",
    highlights: [
      { title: "High-Impact Work", body: "Ship platform capabilities used by global customers.", metric: "Fast cycle" },
      { title: "Cross-Discipline Team", body: "Product, design, engineering, and operations collaboration.", metric: "Integrated" },
      { title: "Growth Tracks", body: "Clear growth paths for IC and leadership roles.", metric: "Structured" },
    ],
    modules: [
      { title: "Open Positions", body: "Live roles across tech and business teams.", metric: "Updated" },
      { title: "Hiring Process", body: "Transparent interview and evaluation stages.", metric: "Clear" },
      { title: "Culture Guide", body: "Values and operating principles for daily execution.", metric: "Documented" },
    ],
  },
  "company-press": {
    eyebrow: "Company",
    title: "Press",
    subtitle: "Official updates, product launches, and media resources for marketplace announcements.",
    image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2200&q=84",
    action: "Open Press Room",
    highlights: [
      { title: "Announcements", body: "Track releases and strategic milestones.", metric: "Official" },
      { title: "Media Kit", body: "Brand assets, leadership bios, and approved visuals.", metric: "Ready" },
      { title: "Press Contact", body: "Direct media response channel with SLA.", metric: "<24h" },
    ],
    modules: [
      { title: "Release Archive", body: "Chronological list of company updates.", metric: "Structured" },
      { title: "Coverage Tracker", body: "Recent media mentions and stories.", metric: "Live" },
      { title: "Asset Library", body: "Logos, product imagery, and fact sheets.", metric: "Downloadable" },
    ],
  },
};

export function AdvancedFooterPage({ page }: { page: Page }) {
  const config = pageConfig[page];
  if (!config) return null;

  return (
    <main className="min-h-screen bg-[#f8f5ee] text-[#1a1510]">
      <section className="relative h-[24rem] overflow-hidden md:h-[30rem]">
        <SmartImage src={config.image} alt={config.title} className="h-full w-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-linear-to-r from-[#17110d]/88 via-[#17110d]/68 to-[#0e3b35]/32" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-[#f8f5ee] to-transparent" />
        <div className="absolute inset-0 mx-auto flex max-w-7xl items-center px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d4c5a9]">{config.eyebrow}</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.03] tracking-[-0.03em] text-[#f3ead8] md:text-7xl">{config.title}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#d4c5a9]/80 md:text-lg">{config.subtitle}</p>
            <button className="mt-7 rounded-lg bg-[#d4c5a9] px-5 py-3 text-sm font-semibold text-[#17110d] transition hover:bg-[#f3ead8]">
              {config.action}
            </button>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {config.highlights.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-lg border border-[#d8c8aa]/70 bg-white/72 p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a2d3b]">{item.metric}</p>
              <h3 className="mt-2 font-serif text-2xl tracking-[-0.02em] text-[#172e2a]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#5e5145]">{item.body}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-[#172e2a]/15 bg-[#172e2a] p-6 text-[#f3ead8] shadow-xl shadow-[#172e2a]/10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#90d4c7]">Advanced Modules</p>
              <h2 className="mt-2 font-serif text-3xl tracking-[-0.02em]">Operational Toolkit</h2>
            </div>
            <p className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-[#d4c5a9]">Production Ready</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {config.modules.map((module) => (
              <div key={module.title} className="rounded-lg border border-white/10 bg-white/7 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#90d4c7]">{module.metric}</p>
                <h3 className="mt-2 text-base font-semibold text-white">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#d4c5a9]/72">{module.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
