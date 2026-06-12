const BASE = "http://localhost:4000/api";

let accessToken: string | null = null;

export function setAccessToken(t: string | null) { accessToken = t; }
export function getAccessToken() { return accessToken; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });

  if (res.status === 401 && accessToken) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      const data = (await refreshed.json()) as { accessToken: string };
      accessToken = data.accessToken;
      headers["Authorization"] = `Bearer ${accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: "include" });
    } else {
      accessToken = null;
      throw new Error("SESSION_EXPIRED");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "UNKNOWN" }));
    throw Object.assign(new Error((err as { error: string }).error), { status: res.status, data: err });
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export const api = {
  content: {
    home: () => get<HomeFeed>("/content/home"),
  },
  auth: {
    register: (body: { email: string; password: string; name: string; kind: "CUSTOMER" | "ARTISAN"; studioName?: string }) =>
      post<{ message: string }>("/auth/register", body),
    login: (body: { email: string; password: string }) =>
      post<{ accessToken: string; role: string; artisanId?: string }>("/auth/login", body),
    logout: () => post<{ message: string }>("/auth/logout"),
    me: () => get<{ id: string; email: string; kind: string }>("/auth/me"),
  },
  products: {
    list: (params?: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      return get<{ products: Product[]; total: number; page: number; pages: number }>(`/products?${q}`);
    },
    get: (slug: string) => get<Product & { reviews: Review[] }>(`/products/${slug}`),
    create: (body: Partial<Product> & { stock?: number; categoryId?: string; priceCents?: number }) =>
      post<{ id: string; slug: string }>("/products", body),
    update: (id: string, body: Partial<Product> & { stock?: number; status?: string }) =>
      patch<{ message: string }>(`/products/${id}`, body),
    mine: () => get<Product[]>("/products/artisan/mine"),
    categories: () => get<Category[]>("/products/meta/categories"),
  },
  orders: {
    checkout: (items: { productId: string; quantity: number }[]) =>
      post<{ orderId: string; totalCents: number; fraudScore: number; status: string }>("/orders/checkout", { items }),
    track: (id: string) => get<{ id: string; status: string; created_at: string; carrier?: string; tracking_number?: string }>(`/orders/track/${id}`),
    getReceipt: (id: string) => get<{ id: string; status: string; total_cents: number; created_at: string; items: { quantity: number; price_cents: number; title: string }[] }>(`/orders/${id}/receipt`),
    checkReturn: (id: string) => get<{ id: string; status: string; eligible: boolean; daysRemaining: number; orderDate: string }>(`/orders/${id}/return-eligibility`),
    requestReturn: (id: string) => post<{ success: boolean; status: string }>(`/orders/${id}/return`),
    mine: () => get<Order[]>("/orders/mine"),
    get: (id: string) => get<Order & { items: OrderItem[] }>(`/orders/${id}`),
    updateStatus: (id: string, status: string) =>
      patch<{ message: string }>(`/orders/${id}/status`, { status }),
  },
  studio: {
    profile: () => get<ArtisanProfile>("/studio/profile"),
    updateProfile: (body: { studioName?: string; story?: string }) =>
      patch<{ message: string }>("/studio/profile", body),
    analytics: () => get<StudioAnalytics>("/studio/analytics"),
    wishlist: () => get<Product[]>("/studio/wishlist"),
    toggleWishlist: (productId: string) => post<{ wishlisted: boolean }>(`/studio/wishlist/${productId}`),
    postReview: (productId: string, body: { rating: number; body: string }) =>
      post<{ message: string }>(`/studio/reviews/${productId}`, body),
    notifications: () => get<AppNotification[]>("/studio/notifications"),
    markRead: (id: string) => patch<{ message: string }>(`/studio/notifications/${id}/read`),
    earnings: () => get<StudioEarnings>("/studio/earnings"),
    payouts: () => get<StudioPayout[]>("/studio/payouts"),
    uploadMedia: (productId: string, file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return fetch(`${BASE}/studio/products/${productId}/media`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
        body: fd,
      }).then((r) => r.json()) as Promise<{ id: string; url: string; alt: string; sort_order: number }>;
    },
    deleteMedia: (productId: string, mediaId: string) =>
      del<{ message: string }>(`/studio/products/${productId}/media/${mediaId}`),
  },
  ai: {
    chat: (messages: { role: string; content: string }[], sessionId?: string) =>
      fetch(`${BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ messages, sessionId }),
      }),
    recommendations: (params: { productId?: string; context?: string }) => {
      const q = new URLSearchParams();
      if (params.productId) q.set("productId", params.productId);
      if (params.context) q.set("context", params.context);
      return get<{ products: Product[] }>(`/ai/recommendations?${q}`);
    },
    visualSearch: (file: File) => {
      const fd = new FormData();
      fd.append("image", file);
      return fetch(`${BASE}/ai/visual-search`, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        credentials: "include",
        body: fd,
      }).then((r) => r.json()) as Promise<{ detected: { object: string; material: string; searchKeywords: string[] }; products: Product[] }>;
    },
    giftFinder: (body: { occasion: string; recipient: string; budgetMin: number; budgetMax: number; interests?: string }) =>
      post<{ gifts: (Product & { aiReason: string })[] }>("/ai/gift-finder", body),
    generateListing: (body: { imageUrl: string; category: string; material?: string }) =>
      post<{ title: string; description: string; tags: string[]; seoKeywords: string[]; suggestedPricePaise: number }>("/ai/generate-listing", body),
    translate: (body: { productId: string; targetLanguage: string }) =>
      post<{ title: string; description: string }>("/ai/translate", body),
    pricingAssist: (body: { title: string; category: string; description: string; material?: string }) =>
      post<{ suggestedMinPaise: number; suggestedMaxPaise: number; reasoning: string; marginNote: string }>("/ai/pricing-assist", body),
    fraudAnalyze: (orderId: string) =>
      post<{ score: number; reason: string; recommendation: string }>("/ai/fraud-analyze", { orderId }),
    qualityCheck: (body: { productId: string; imageUrl: string; title: string; description: string }) =>
      post<{ imageQuality: string; authenticityScore: number; duplicateRisk: string; recommendation: string; notes: string }>("/ai/quality-check", body),
    adminInsights: () =>
      get<{ insights: { title: string; detail: string; action: string; urgency: string }[] }>("/ai/admin-insights"),
    artisanStory: (body: { studioName: string; craft: string; story?: string; location?: string; yearsActive?: number }) =>
      post<{ story: string }>("/ai/artisan-story", body),
  },
  admin: {
    analytics: () => get<AdminAnalytics>("/admin/analytics"),
    catalogProducts: () => get<CatalogProduct[]>("/admin/catalog/products"),
    createCatalogProduct: (body: CatalogProductForm) => post<{ id: string; slug: string }>("/admin/catalog/products", body),
    updateCatalogProduct: (id: string, body: Partial<CatalogProductForm>) => patch<{ message: string }>(`/admin/catalog/products/${id}`, body),
    deleteCatalogProduct: (id: string) => del<{ message: string }>(`/admin/catalog/products/${id}`),
    catalogArtisans: () => get<CatalogArtisan[]>("/admin/catalog/artisans"),
    updateCatalogArtisan: (id: string, body: Partial<CatalogArtisanForm>) => patch<{ message: string }>(`/admin/catalog/artisans/${id}`, body),
    catalogCategories: () => get<CatalogCategory[]>("/admin/catalog/categories"),
    createCategory: (body: CatalogCategoryForm) => post<{ id: string; slug: string }>("/admin/catalog/categories", body),
    updateCategory: (id: string, body: Partial<CatalogCategoryForm>) => patch<{ message: string }>(`/admin/catalog/categories/${id}`, body),
    deleteCategory: (id: string) => del<{ message: string }>(`/admin/catalog/categories/${id}`),
    users: (params?: Record<string, string | number | undefined>) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      return get<{ users: AdminUser[]; total: number; pages: number }>(`/admin/users?${q}`);
    },
    userStatus: (id: string, action: "suspend" | "activate") =>
      patch<{ message: string }>(`/admin/users/${id}/status`, { action }),
    pendingArtisans: () => get<PendingArtisan[]>("/admin/artisans/pending"),
    approveArtisan: (id: string, approved: boolean) =>
      patch<{ message: string }>(`/admin/artisans/${id}/approve`, { approved }),
    pendingProducts: () => get<AdminProduct[]>("/admin/products/review"),
    productStatus: (id: string, status: string) =>
      patch<{ message: string }>(`/admin/products/${id}/status`, { status }),
    orders: (params?: Record<string, string | number | boolean | undefined>) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
      return get<{ orders: AdminOrder[]; total: number; pages: number }>(`/admin/orders?${q}`);
    },
    // Site Settings
    settings: () => get<{ settings: SiteSettings; updatedAt: string }>("/admin/settings"),
    updateSettings: (body: Partial<SiteSettings>) => patch<{ message: string; updated: number }>("/admin/settings", body),
    // Security
    sessions: () => get<ActiveSession[]>("/admin/security/sessions"),
    killSession: (id: string) => del<{ message: string }>(`/admin/security/sessions/${id}`),
    securityEvents: () => get<SecurityEvent[]>("/admin/security/events"),
    // Financials
    financials: (from?: string, to?: string) => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return get<FinancialData>(`/admin/financials?${q}`);
    },
    // Order detail
    orderDetail: (id: string) => get<AdminOrderDetail>(`/admin/orders/${id}`),
    // Order status update with tracking
    updateOrderStatus: (id: string, body: { status: string; trackingNumber?: string; carrier?: string }) =>
      patch<{ message: string }>(`/admin/orders/${id}/status`, body),
    // Bulk order update
    bulkUpdateOrders: (orders: { id: string; status: string; trackingNumber?: string; carrier?: string }[]) =>
      patch<{ results: { id: string; success: boolean; error?: string }[] }>("/admin/orders/bulk", { orders }),
    // Inactive admins
    inactiveAdmins: () => get<{ id: string; email: string; created_at: string }[]>("/admin/security/inactive-admins"),
    // Payout management
    setPayout: (artisanId: string) => patch<{ message: string }>(`/admin/payouts/${artisanId}`),
  },
  payments: {
    checkout: (body: { items: { productId: string; quantity: number }[]; couponCode?: string; guestEmail?: string }) =>
      post<{ clientSecret: string; orderId: string; amountCents: number }>("/payments/checkout", body),
    refund: (orderId: string) =>
      post<{ success: boolean }>(`/payments/refund/${orderId}`),
  },
  customer: {
    profile: () => get<CustomerProfile>("/customer/profile"),
    updateProfile: (body: { name: string }) => patch<{ message: string }>("/customer/profile", body),
    addAddress: (body: { line1: string; city: string; country: string; postal: string }) =>
      post<Address>("/customer/addresses", body),
    orders: () => get<CustomerOrder[]>("/customer/orders"),
  },
  recommendations: {
    get: (params?: { productId?: string }) => {
      const q = new URLSearchParams();
      if (params?.productId) q.set("productId", params.productId);
      return get<Product[]>(`/recommendations?${q}`);
    },
    recordEvent: (body: { eventType: "VIEW" | "CART_ADD" | "SEARCH"; productId?: string; query?: string }) =>
      post<void>("/recommendations/event", body),
  },
};

export type Product = {
  id: string; title: string; slug: string; price_cents: number; image_url: string;
  category: string; category_slug: string; artisan: string; stock: number;
  avg_rating: number; review_count: number; description?: string; created_at: string;
};
export type HomeFeed = {
  hero: { title: string; subtitle: string; image: string };
  stats: { products: string | number; artisans: string | number; customers: string | number; orders: string | number; categories: number };
  collections: { title: string; count: string; image: string }[];
  recommendations: { name: string; artisan: string; price: string; image: string }[];
  artisans: { name: string; craft: string; followers: string; image: string }[];
  spaces: { name: string; count: string; image: string }[];
  trending: { name: string; price: string; image: string }[];
  testimonials: { name: string; location: string; text: string }[];
  inspirations: { title: string; image: string }[];
};
export type Category = { id: string; name: string; slug: string };
export type Review = { rating: number; body: string; created_at: string; customer_name: string };
export type Order = { id: string; status: string; total_cents: number; fraud_score: number; created_at: string; item_count: number };
export type OrderItem = { quantity: number; price_cents: number; title: string; image_url: string; slug: string };
export type ArtisanProfile = { id: string; studio_name: string; story: string; approved: number; product_count: number };
export type StudioAnalytics = {
  totalRevenue: number;
  topProducts: { title: string; units_sold: number; stock: number; price_cents: number }[];
  recentOrders: { id: string; status: string; total_cents: number; created_at: string }[];
  lowStock: { title: string; quantity: number; low_stock_at: number }[];
  avgRating: { avg: number; count: number };
};
export type AdminAnalytics = {
  gmv: number; orderStats: { status: string; count: number }[];
  topArtisans: { studio_name: string; products: number; revenue: number }[];
  topProducts: { title: string; price_cents: number; units_sold: number }[];
  userCounts: { kind: string; count: number }[];
  fraudAlerts: { id: string; fraud_score: number; total_cents: number; status: string; customer: string }[];
  recentActivity: { action: string; entity: string; created_at: string; email: string }[];
  dailyRevenue: { date: string; revenue: number; orders: number }[];
};
export type AdminUser = { id: string; email: string; kind: string; suspended: number; created_at: string };
export type PendingArtisan = { id: string; studio_name: string; story: string; created_at: string; email: string };
export type AdminProduct = { id: string; title: string; price_cents: number; status: string; artisan: string };
export type AdminOrder = { id: string; status: string; total_cents: number; fraud_score: number; created_at: string; customer: string; item_count: number };
export type AppNotification = { id: string; title: string; body: string; read_at: string | null; created_at: string };
export type SiteSettings = {
  maintenance_mode: string;
  registration_enabled: string;
  ai_features_enabled: string;
  guest_checkout_enabled: string;
  reviews_enabled: string;
  max_login_attempts: string;
};
export type ActiveSession = {
  id: string;
  auth_account_id: string;
  created_at: string;
  expires_at: string;
  ip_address: string;
  email: string;
  kind: string;
};
export type SecurityEvent = {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  ip_address: string;
  created_at: string;
  metadata: string;
  email: string;
};
export type CatalogProduct = {
  id: string;
  title: string;
  slug: string;
  description: string;
  price_cents: number;
  status: string;
  featured: number;
  image_url: string;
  created_at: string;
  updated_at: string;
  category_id: string;
  category: string;
  artisan_id: string;
  artisan: string;
  stock: number;
};
export type CatalogProductForm = {
  title: string;
  description: string;
  priceCents: number;
  categoryId: string;
  imageUrl: string;
  stock: number;
  status: "ACTIVE" | "PENDING_REVIEW" | "SUSPENDED" | "ARCHIVED";
  featured: boolean;
  artisanId: string;
};
export type CatalogArtisan = {
  id: string;
  studio_name: string;
  story: string;
  approved: number;
  featured: number;
  created_at: string;
  email: string;
  product_count: number;
  follower_count: number;
};
export type CatalogArtisanForm = {
  studioName: string;
  story: string;
  approved: boolean;
  featured: boolean;
};
export type CatalogCategory = { id: string; name: string; slug: string; sort_order: number; product_count: number };
export type CatalogCategoryForm = { name: string; slug: string; sortOrder: number };

// New types for platform enhancement
export type FinancialData = {
  gmvCents: number;
  refundsCents: number;
  razorpayFeesEstimateCents: number;
  payoutsDisbursedCents: number;
  netRevenueCents: number;
  perArtisan: { studioName: string; totalRevenueCents: number; unitsSold: number; payoutStatus: string }[];
};
export type AdminOrderDetail = {
  id: string; status: string; total_cents: number; fraud_score: number;
  created_at: string; updated_at: string; customerName: string;
  items: { title: string; quantity: number; price_cents: number; image_url: string }[];
  payment: { provider: string; status: string; amount_cents: number } | null;
  shipping: { carrier: string; trackingNumber: string; status: string } | null;
};
export type CustomerProfile = {
  id: string; name: string; email: string;
  addresses: Address[];
  orderCount: number;
  lifetimeSpendCents: number;
};
export type Address = {
  id: string; line1: string; city: string; country: string; postal: string; created_at: string;
};
export type CustomerOrder = {
  id: string; status: string; total_cents: number; created_at: string;
  item_count: number; payment_status: string | null;
};
export type StudioEarnings = {
  lifetimeRevenueCents: number;
  perProduct: { productId: string; title: string; revenueCents: number; unitsSold: number }[];
  dailySeries: { date: string; revenueCents: number; orders: number }[];
  approved: boolean;
};
export type StudioPayout = {
  id: string; amountCents: number; status: string; period: string; createdAt: string;
};
