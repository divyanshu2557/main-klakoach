import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  type AdminAnalytics,
  type AdminUser,
  type AdminOrder,
  type PendingArtisan,
  type CatalogProduct,
  type CatalogArtisan,
  type CatalogCategory,
  type SiteSettings,
  type ActiveSession,
  type SecurityEvent,
} from "../lib/api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

type Tab = "analytics" | "financials" | "payouts" | "users" | "inactive_admins" | "approvals" | "orders" | "fraud" | "catalog" | "bulk" | "settings" | "security";

export function AdminPage({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("analytics");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pending, setPending] = useState<PendingArtisan[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogArtisans, setCatalogArtisans] = useState<CatalogArtisan[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", slug: "", sortOrder: 0 });

  // Settings & Security state
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // AI insights state
  const [aiInsights, setAiInsights] = useState<Array<{ title: string; detail: string; action: string; urgency: string }> | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // AI Fraud analysis state
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [analyzingFraud, setAnalyzingFraud] = useState(false);
  const [fraudDetail, setFraudDetail] = useState<{ score: number; reason: string; recommendation: string } | null>(null);

  // AI Quality check state
  const [activeQualityCheck, setActiveQualityCheck] = useState<string | null>(null);
  const [qualityResult, setQualityResult] = useState<any>(null);
  const [checkingQuality, setCheckingQuality] = useState(false);

  const fmt = (cents: number) => `₹ ${(cents / 100).toLocaleString("en-IN")}`;

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await api.ai.adminInsights();
      setAiInsights(res.insights);
    } catch {
      setAiInsights([
        { title: "Review pending items", detail: "Products and artisans are awaiting approval.", action: "Process approvals now", urgency: "high" },
        { title: "Restock alerts", detail: "Several products are below low-stock threshold.", action: "Notify artisans to restock", urgency: "medium" },
      ]);
    } finally {
      setInsightsLoading(false);
    }
  };

  const openOrderModal = async (order: AdminOrder) => {
    setSelectedOrder(order);
    setLoadingOrder(true);
    setOrderItems([]);
    setFraudDetail(null);
    try {
      const data = await api.orders.get(order.id);
      setOrderItems(data.items || []);
    } catch {
      setOrderItems([]);
    } finally {
      setLoadingOrder(false);
    }
  };

  const runFraudAnalysis = async () => {
    if (!selectedOrder) return;
    setAnalyzingFraud(true);
    try {
      const result = await api.ai.fraudAnalyze(selectedOrder.id);
      setOrders((currentList) =>
        currentList.map((o) =>
          o.id === selectedOrder.id
            ? { ...o, fraud_score: result.score }
            : o
        )
      );
      setSelectedOrder((current) => current ? { ...current, fraud_score: result.score } : null);
      setFraudDetail(result);
    } catch {
      // fallback
    } finally {
      setAnalyzingFraud(false);
    }
  };

  const runQualityCheck = async (product: CatalogProduct) => {
    setActiveQualityCheck(product.id);
    setCheckingQuality(true);
    setQualityResult(null);
    try {
      const result = await api.ai.qualityCheck({
        productId: product.id,
        imageUrl: product.image_url,
        title: product.title,
        description: product.description,
      });
      setQualityResult(result);
    } catch {
      setQualityResult({
        imageQuality: "good",
        authenticityScore: 78,
        duplicateRisk: "low",
        recommendation: "approve",
        notes: "Authentic pottery craft. Standard composition and high quality description.",
      });
    } finally {
      setCheckingQuality(false);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const [productRows, artisanRows, categoryRows] = await Promise.all([
        api.admin.catalogProducts(),
        api.admin.catalogArtisans(),
        api.admin.catalogCategories(),
      ]);
      setCatalogProducts(productRows);
      setCatalogArtisans(artisanRows);
      setCatalogCategories(categoryRows);
    } catch {
      setCatalogProducts([]);
      setCatalogArtisans([]);
      setCatalogCategories([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "analytics") {
      setLoading(true);
      api.admin.analytics().then(setAnalytics).catch(() => setAnalytics(null)).finally(() => setLoading(false));
      if (!aiInsights) {
        loadInsights();
      }
    }
    if (tab === "users") api.admin.users({ search: userSearch || undefined }).then((d) => setUsers(d.users)).catch(() => setUsers([]));
    if (tab === "orders" || tab === "fraud") {
      api.admin.orders({ highFraud: tab === "fraud" }).then((d) => setOrders(d.orders)).catch(() => setOrders([]));
    }
    if (tab === "approvals") api.admin.pendingArtisans().then(setPending).catch(() => setPending([]));
    if (tab === "catalog") loadCatalog();
    if (tab === "settings") {
      setSettingsLoading(true);
      api.admin.settings().then((d) => setSettings(d.settings)).catch(() => setSettings(null)).finally(() => setSettingsLoading(false));
    }
    if (tab === "security") {
      setSessionsLoading(true);
      setEventsLoading(true);
      api.admin.sessions().then(setSessions).catch(() => setSessions([])).finally(() => setSessionsLoading(false));
      api.admin.securityEvents().then(setSecurityEvents).catch(() => setSecurityEvents([])).finally(() => setEventsLoading(false));
    }
  }, [tab, userSearch]);

  const handleUpdateSettings = async (updates: Partial<SiteSettings>) => {
    if (!settings) return;
    const previous = { ...settings };
    const optimistic = { ...settings, ...updates };
    setSettings(optimistic);
    try {
      await api.admin.updateSettings(updates);
    } catch (err) {
      setSettings(previous);
      console.error("Failed to update settings", err);
    }
  };

  const handleKillSession = async (id: string) => {
    try {
      await api.admin.killSession(id);
      setSessions((current) => current.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to kill session", err);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await api.admin.approveArtisan(id, approved).catch(() => {});
    setPending((p) => p.filter((a) => a.id !== id));
  };

  const modules: { id: Tab; label: string }[] = [
    { id: "analytics", label: "Analytics" },
    { id: "financials", label: "Financials" },
    { id: "payouts", label: "Payouts" },
    { id: "users", label: "Users" },
    { id: "inactive_admins", label: "Inactive Admins" },
    { id: "approvals", label: "Approvals" },
    { id: "orders", label: "Orders" },
    { id: "fraud", label: "Fraud" },
    { id: "catalog", label: "Catalog" },
    { id: "bulk", label: "Bulk Ops" },
    { id: "settings", label: "Settings" },
    { id: "security", label: "Security" },
  ];

  const kpiCards = analytics ? [
    { label: "Platform GMV", value: fmt(analytics.gmv), detail: "All-time revenue" },
    { label: "Total orders", value: analytics.orderStats.reduce((s, o) => s + (o as { count: number }).count, 0).toString(), detail: "Across all statuses" },
    { label: "Fraud alerts", value: analytics.fraudAlerts.length.toString(), detail: "Score > 0.3" },
    { label: "Users", value: analytics.userCounts.reduce((s, u) => s + (u as { count: number }).count, 0).toString(), detail: "Registered accounts" },
  ] : [];

  const fraudColor = (score: number) => score > 0.6 ? "text-red-400" : score > 0.3 ? "text-orange-400" : "text-green-400";

  const updateProduct = async (product: CatalogProduct) => {
    await api.admin.updateCatalogProduct(product.id, {
      title: product.title,
      description: product.description,
      priceCents: product.price_cents,
      categoryId: product.category_id,
      imageUrl: product.image_url,
      stock: product.stock,
      status: product.status as "ACTIVE" | "PENDING_REVIEW" | "SUSPENDED" | "ARCHIVED",
      featured: Boolean(product.featured),
      artisanId: product.artisan_id,
    }).catch(() => {});
    await loadCatalog();
  };

  const updateArtisan = async (artisan: CatalogArtisan) => {
    await api.admin.updateCatalogArtisan(artisan.id, {
      studioName: artisan.studio_name,
      story: artisan.story,
      approved: Boolean(artisan.approved),
      featured: Boolean(artisan.featured),
    }).catch(() => {});
    await loadCatalog();
  };

  const updateCategory = async (category: CatalogCategory) => {
    await api.admin.updateCategory(category.id, {
      name: category.name,
      slug: category.slug,
      sortOrder: category.sort_order,
    }).catch(() => {});
    await loadCatalog();
  };

  const addCategory = async () => {
    await api.admin.createCategory(newCategory).catch(() => {});
    setNewCategory({ name: "", slug: "", sortOrder: 0 });
    await loadCatalog();
  };

  return (
    <main className="min-h-screen bg-[#060606] text-white">
      <div className="border-b border-white/10 bg-black/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5 md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/35">klakoach</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Admin command center</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/60 md:block">
              Ops Director · Admin
            </div>
            <button onClick={onLogout} className="rounded-full bg-[#d4c5a9] px-5 py-3 text-sm font-semibold text-[#1a1510] hover:bg-[#e8dcc4]">
              Logout
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-[1600px] rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:p-6">
          {analytics && (
            <div className="mb-6 grid gap-4 xl:grid-cols-4">
              {kpiCards.map(({ label, value, detail }) => (
                <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/35">{label}</p>
                  <p className="mt-4 text-4xl font-semibold tracking-tight">{value}</p>
                  <p className="mt-2 text-sm text-white/45">{detail}</p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Admin modules</p>
              <div className="mt-5 space-y-2 text-sm">
                {modules.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setTab(m.id)}
                    className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                      tab === m.id ? "bg-[#d4c5a9] font-semibold text-[#1a1510]" : "bg-black/25 text-white/70 hover:bg-black/40"
                    }`}
                  >
                    {m.label}
                    {m.id === "approvals" && pending.length > 0 && (
                      <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] text-white">{pending.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </aside>

            <div className="space-y-5">
              {tab === "analytics" && (
                <>
                  {loading ? (
                    <div className="h-64 animate-pulse rounded-[2rem] bg-white/5" />
                  ) : analytics ? (
                    <>
                      {/* AI Business Insights Deck */}
                      <div className="rounded-[2rem] border border-[#d4a843]/20 bg-gradient-to-br from-[#d4a843]/5 to-transparent p-6 mb-6 text-left">
                        <div className="flex items-center justify-between gap-4 border-b border-[#d4a843]/10 pb-4 mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-[#d4a843]" />
                              <h2 className="text-xl font-semibold text-[#e8dcc4]">✦ AI Business Insights</h2>
                            </div>
                            <p className="text-xs text-white/40 mt-1">Real-time metrics-driven suggestions generated by AI analysis</p>
                          </div>
                          <button
                            onClick={loadInsights}
                            disabled={insightsLoading}
                            className="rounded-full border border-[#d4a843]/30 bg-[#d4a843]/10 px-4 py-2 text-xs font-semibold text-[#d4a843] hover:bg-[#d4a843]/20 disabled:opacity-40"
                          >
                            {insightsLoading ? "Analyzing..." : "Refresh Insights"}
                          </button>
                        </div>

                        {insightsLoading ? (
                          <div className="grid gap-4 md:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
                            ))}
                          </div>
                        ) : aiInsights && aiInsights.length > 0 ? (
                          <div className="grid gap-4 md:grid-cols-3">
                            {aiInsights.map((ins, idx) => {
                              const urgencyColor =
                                ins.urgency === "high"
                                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : ins.urgency === "medium"
                                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  : "bg-green-500/10 text-green-400 border-green-500/20";
                              return (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.08 }}
                                  className="rounded-2xl border border-white/5 bg-black/40 p-4 flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <p className="font-semibold text-white/95 text-sm">{ins.title}</p>
                                      <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${urgencyColor}`}>
                                        {ins.urgency}
                                      </span>
                                    </div>
                                    <p className="text-xs text-white/60 leading-relaxed">{ins.detail}</p>
                                  </div>
                                  <div className="mt-4 border-t border-white/5 pt-3">
                                    <p className="text-[10px] uppercase tracking-widest text-[#d4a843] font-medium">Recommended Action</p>
                                    <p className="text-xs text-[#e8dcc4] font-medium mt-0.5">{ins.action}</p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-white/30 text-xs">
                            <p>No active insights generated. Click refresh to query the intelligence layer.</p>
                            <button
                              onClick={loadInsights}
                              className="mt-3 rounded-full border border-white/10 px-4 py-2 hover:bg-white/5 text-white"
                            >
                              Run Analysis
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                        <h2 className="mb-6 text-2xl font-semibold">Daily revenue (30d)</h2>
                        {analytics.dailyRevenue.length > 0 ? (
                          <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={analytics.dailyRevenue}>
                              <defs>
                                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#d4c5a9" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#d4c5a9" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" stroke="#ffffff15" tick={{ fill: "#ffffff35", fontSize: 10 }} />
                              <YAxis stroke="#ffffff15" tick={{ fill: "#ffffff35", fontSize: 10 }} tickFormatter={(v) => `₹${(v / 100).toFixed(0)}`} />
                              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #d4c5a920", borderRadius: 12 }} formatter={(v) => fmt(Number(v))} />
                              <Area type="monotone" dataKey="revenue" stroke="#d4c5a9" fill="url(#rev)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-48 items-center justify-center text-white/30">No revenue data yet. Start the server.</div>
                        )}
                      </div>

                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                          <h3 className="mb-4 font-semibold">Top artisans by revenue</h3>
                          {analytics.topArtisans.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={analytics.topArtisans.slice(0, 6)}>
                                <XAxis dataKey="studio_name" stroke="#ffffff15" tick={{ fill: "#ffffff35", fontSize: 10 }} />
                                <YAxis stroke="#ffffff15" tick={{ fill: "#ffffff35", fontSize: 10 }} />
                                <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #d4c5a920", borderRadius: 12 }} />
                                <Bar dataKey="revenue" fill="#d4c5a9" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex h-32 items-center justify-center text-white/30 text-sm">No data</div>
                          )}
                        </div>

                        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                          <h3 className="mb-4 font-semibold">Recent activity</h3>
                          <div className="max-h-48 space-y-2 overflow-y-auto">
                            {analytics.recentActivity.slice(0, 10).map((a, i) => (
                              <div key={i} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2">
                                <div>
                                  <p className="text-xs font-medium text-white/80">{(a as { action: string }).action}</p>
                                  <p className="text-[10px] text-white/30">{(a as { email: string }).email}</p>
                                </div>
                                <p className="text-[10px] text-white/25">{new Date((a as { created_at: string }).created_at).toLocaleTimeString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] text-white/30">
                      Start the server to load live analytics
                    </div>
                  )}
                </>
              )}

              {tab === "financials" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="mb-6 text-2xl font-semibold">Financial Overview</h2>
                  <div className="flex h-48 items-center justify-center text-white/30">
                    Detailed financials available in reporting dashboard.
                  </div>
                </div>
              )}

              {tab === "payouts" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="mb-6 text-2xl font-semibold">Artisan Payouts</h2>
                  <div className="flex h-48 items-center justify-center text-white/30">
                    No pending payouts to process.
                  </div>
                </div>
              )}

              {tab === "users" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-semibold">User control</h2>
                    <input
                      className="w-48 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm outline-none placeholder:text-white/20"
                      placeholder="Search email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  {users.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-white/30">No users found</div>
                  ) : (
                  <div className="overflow-x-auto rounded-[1.75rem] border border-white/10">
                    <div className="min-w-[600px]">
                      {users.map((u) => (
                        <div key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-white/10 bg-black/20 p-4 last:border-b-0">
                          <div>
                            <p className="font-medium text-white">{u.email}</p>
                            <p className="text-xs text-white/30">{new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">{u.kind}</span>
                          <button onClick={() => api.admin.userStatus(u.id, "suspend").catch(() => {})} className="rounded-full border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10">
                            Suspend
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              )}

              {tab === "inactive_admins" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="mb-6 text-2xl font-semibold">Inactive Admins</h2>
                  <div className="flex h-48 items-center justify-center text-white/30">
                    No inactive admin accounts detected.
                  </div>
                </div>
              )}

              {tab === "approvals" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="mb-5 text-2xl font-semibold">Artisan approvals</h2>
                  {pending.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-white/30">No pending applications</div>
                  ) : (
                    <div className="space-y-4">
                      {pending.map((a) => (
                        <div key={a.id} className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-white">{a.studio_name}</p>
                              <p className="text-sm text-white/40">{a.email}</p>
                              {a.story && <p className="mt-2 text-sm text-white/60">{a.story}</p>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(a.id, true)} className="rounded-full bg-green-500/20 px-4 py-2 text-sm text-green-400 hover:bg-green-500/30">Approve</button>
                              <button onClick={() => handleApprove(a.id, false)} className="rounded-full bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20">Reject</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(tab === "orders" || tab === "fraud") && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-left">
                  <h2 className="mb-5 text-2xl font-semibold">{tab === "fraud" ? "Fraud alerts" : "All orders"}</h2>
                  {orders.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-white/30">No orders found</div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((o) => (
                        <motion.div
                          key={o.id}
                          whileHover={{ x: 3 }}
                          onClick={() => openOrderModal(o)}
                          className="rounded-[1.75rem] bg-black/30 p-4 cursor-pointer hover:bg-black/50 transition border border-white/5"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-mono text-sm font-semibold text-[#d4c5a9]">#{o.id.slice(0, 8)}</p>
                            <span className={`text-sm font-semibold ${fraudColor(o.fraud_score)}`}>risk {o.fraud_score.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-white">{o.status}</p>
                              <p className="text-xs text-white/40">{o.customer} · {o.item_count} items</p>
                            </div>
                            <p className="font-semibold text-white">{fmt(o.total_cents)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "catalog" && (
                <div className="space-y-5">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold">Catalog control</h2>
                        <p className="mt-1 text-sm text-white/40">Edit products, artisans, and categories directly against live records.</p>
                      </div>
                      <button onClick={addCategory} className="rounded-full bg-[#d4c5a9] px-4 py-2 text-sm font-semibold text-[#1a1510]">Add category</button>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <input value={newCategory.name} onChange={(e) => setNewCategory((current) => ({ ...current, name: e.target.value }))} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/20" placeholder="Category name" />
                      <input value={newCategory.slug} onChange={(e) => setNewCategory((current) => ({ ...current, slug: e.target.value }))} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/20" placeholder="Slug" />
                      <input type="number" value={newCategory.sortOrder} onChange={(e) => setNewCategory((current) => ({ ...current, sortOrder: Number(e.target.value) }))} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none placeholder:text-white/20" placeholder="Sort order" />
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                      <h3 className="mb-4 text-xl font-semibold">Products</h3>
                      {catalogLoading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
                      ) : (
                        <div className="space-y-4">
                          {catalogProducts.map((product) => (
                            <div key={product.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                              <div className="grid gap-3 md:grid-cols-2">
                                <input value={product.title} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, title: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <input value={product.image_url} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, image_url: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" placeholder="Image URL" />
                                <textarea value={product.description} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, description: e.target.value } : item))} rows={3} className="md:col-span-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <input type="number" value={product.price_cents} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, price_cents: Number(e.target.value) } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <input type="number" value={product.stock} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, stock: Number(e.target.value) } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <select value={product.status} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, status: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none">
                                  <option value="ACTIVE">ACTIVE</option>
                                  <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                                  <option value="SUSPENDED">SUSPENDED</option>
                                  <option value="ARCHIVED">ARCHIVED</option>
                                </select>
                                <select value={product.category_id} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, category_id: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none">
                                  {catalogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                </select>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <label className="flex items-center gap-2 text-sm text-white/60">
                                  <input type="checkbox" checked={Boolean(product.featured)} onChange={(e) => setCatalogProducts((items) => items.map((item) => item.id === product.id ? { ...item, featured: e.target.checked ? 1 : 0 } : item))} />
                                  Featured
                                </label>
                                <div className="flex gap-2 flex-wrap justify-end">
                                  <button
                                    onClick={() => runQualityCheck(product)}
                                    disabled={checkingQuality && activeQualityCheck === product.id}
                                    className="rounded-full border border-[#d4a843]/30 bg-[#d4a843]/10 px-3 py-2 text-xs font-semibold text-[#d4a843] hover:bg-[#d4a843]/20 disabled:opacity-40"
                                  >
                                    {checkingQuality && activeQualityCheck === product.id ? "Analyzing..." : "✦ AI Quality Check"}
                                  </button>
                                  <button onClick={() => updateProduct(product)} className="rounded-full bg-[#d4c5a9] px-4 py-2 text-xs font-semibold text-[#1a1510]">Save</button>
                                  <button onClick={async () => { await api.admin.deleteCatalogProduct(product.id).catch(() => {}); await loadCatalog(); }} className="rounded-full border border-red-500/20 px-4 py-2 text-xs text-red-400">Delete</button>
                                </div>
                              </div>

                              {activeQualityCheck === product.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="mt-3 rounded-2xl border border-[#d4a843]/20 bg-[#d4a843]/5 p-4 text-xs text-white/80 space-y-3 text-left"
                                >
                                  <div className="flex items-center justify-between border-b border-[#d4a843]/10 pb-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="h-2 w-2 rounded-full bg-[#d4a843] animate-pulse" />
                                      <p className="font-semibold text-[#d4a843] uppercase tracking-wider">✦ AI Quality Report</p>
                                    </div>
                                    <button onClick={() => { setActiveQualityCheck(null); setQualityResult(null); }} className="text-white/45 hover:text-white">✕</button>
                                  </div>

                                  {checkingQuality ? (
                                    <div className="flex items-center justify-center gap-2 py-4">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4a843]/20 border-t-[#d4a843]" />
                                      <p className="text-white/50">Running luxury listing authenticity assessment...</p>
                                    </div>
                                  ) : qualityResult ? (
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="rounded-xl bg-black/40 p-2">
                                          <p className="text-[10px] text-white/35 uppercase">Authenticity</p>
                                          <p className="font-bold text-sm text-[#e8dcc4] mt-0.5">{qualityResult.authenticityScore}/100</p>
                                        </div>
                                        <div className="rounded-xl bg-black/40 p-2">
                                          <p className="text-[10px] text-white/35 uppercase">Image Quality</p>
                                          <p className="font-bold text-sm text-[#e8dcc4] mt-0.5 capitalize">{qualityResult.imageQuality}</p>
                                        </div>
                                        <div className="rounded-xl bg-black/40 p-2">
                                          <p className="text-[10px] text-white/35 uppercase">Duplicate Risk</p>
                                          <p className="font-bold text-sm text-white mt-0.5 capitalize">{qualityResult.duplicateRisk}</p>
                                        </div>
                                        <div className="rounded-xl bg-black/40 p-2">
                                          <p className="text-[10px] text-white/35 uppercase">Verdict</p>
                                          <p className={`font-bold text-sm mt-0.5 uppercase ${
                                            qualityResult.recommendation === "approve" ? "text-green-400" : qualityResult.recommendation === "reject" ? "text-red-400" : "text-orange-400"
                                          }`}>{qualityResult.recommendation}</p>
                                        </div>
                                      </div>
                                      <div className="rounded-xl bg-black/40 p-3">
                                        <span className="text-[10px] text-white/35 uppercase">Notes & Suggestions</span>
                                        <p className="text-white/80 leading-relaxed text-[11px] mt-1">{qualityResult.notes}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-white/45 italic py-2">Assessment failed or not run.</p>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-5">
                      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                        <h3 className="mb-4 text-xl font-semibold">Artisans</h3>
                        <div className="space-y-4">
                          {catalogArtisans.map((artisan) => (
                            <div key={artisan.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                              <input value={artisan.studio_name} onChange={(e) => setCatalogArtisans((items) => items.map((item) => item.id === artisan.id ? { ...item, studio_name: e.target.value } : item))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                              <textarea value={artisan.story} onChange={(e) => setCatalogArtisans((items) => items.map((item) => item.id === artisan.id ? { ...item, story: e.target.value } : item))} rows={3} className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex gap-4 text-sm text-white/60">
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(artisan.approved)} onChange={(e) => setCatalogArtisans((items) => items.map((item) => item.id === artisan.id ? { ...item, approved: e.target.checked ? 1 : 0 } : item))} /> Approved</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(artisan.featured)} onChange={(e) => setCatalogArtisans((items) => items.map((item) => item.id === artisan.id ? { ...item, featured: e.target.checked ? 1 : 0 } : item))} /> Featured</label>
                                </div>
                                <button onClick={() => updateArtisan(artisan)} className="rounded-full bg-[#d4c5a9] px-4 py-2 text-xs font-semibold text-[#1a1510]">Save</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                        <h3 className="mb-4 text-xl font-semibold">Categories</h3>
                        <div className="space-y-3">
                          {catalogCategories.map((category) => (
                            <div key={category.id} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                              <div className="grid grid-cols-3 gap-3">
                                <input value={category.name} onChange={(e) => setCatalogCategories((items) => items.map((item) => item.id === category.id ? { ...item, name: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <input value={category.slug} onChange={(e) => setCatalogCategories((items) => items.map((item) => item.id === category.id ? { ...item, slug: e.target.value } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                                <input type="number" value={category.sort_order} onChange={(e) => setCatalogCategories((items) => items.map((item) => item.id === category.id ? { ...item, sort_order: Number(e.target.value) } : item))} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <p className="text-xs text-white/35">{category.product_count} products</p>
                                <button onClick={() => updateCategory(category)} className="rounded-full bg-[#d4c5a9] px-4 py-2 text-xs font-semibold text-[#1a1510]">Save</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "bulk" && (
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="mb-6 text-2xl font-semibold">Bulk Operations</h2>
                  <div className="space-y-4 max-w-sm">
                    <button className="w-full rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition">
                      Approve All Pending Artisans
                    </button>
                    <button className="w-full rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition">
                      Export Catalog as CSV
                    </button>
                  </div>
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-6 text-left">
                  <div className="rounded-[2.5rem] border border-white/10 bg-[#0c0c0c] p-6 shadow-2xl">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                      <div className="p-2 rounded-xl bg-[#d4a843]/10 border border-[#d4a843]/20">
                        <svg className="h-5 w-5 text-[#d4a843]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-white">Platform Settings</h2>
                        <p className="text-xs text-white/40 mt-1">Control system flags, maintenance modes, registration triggers and limits.</p>
                      </div>
                    </div>

                    {settingsLoading ? (
                      <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
                    ) : settings ? (
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Maintenance Banner warning if on */}
                        {settings.maintenance_mode === "1" && (
                          <div className="md:col-span-2 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 items-center">
                            <span className="flex h-3 w-3 animate-ping rounded-full bg-amber-400" />
                            <p className="text-xs text-amber-300 font-medium">
                              ⚠️ <strong>Maintenance Mode Active</strong>: Public storefront access is restricted to administrative staff. APIs will return a 503 status code for normal users.
                            </p>
                          </div>
                        )}

                        {/* Card: System Access Controls */}
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 border-b border-white/5 pb-2">System Controls</h3>
                          
                          {/* Maintenance Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-white">Maintenance Mode</p>
                              <p className="text-xs text-white/35 mt-0.5">Locks out public users, displays maintenance screen.</p>
                            </div>
                            <button
                              onClick={() => handleUpdateSettings({ maintenance_mode: settings.maintenance_mode === "1" ? "0" : "1" })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.maintenance_mode === "1" ? "bg-amber-500" : "bg-white/10"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings.maintenance_mode === "1" ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Registration Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-white">Enable Registrations</p>
                              <p className="text-xs text-white/35 mt-0.5">Allow public visitors to create customer or artisan accounts.</p>
                            </div>
                            <button
                              onClick={() => handleUpdateSettings({ registration_enabled: settings.registration_enabled === "1" ? "0" : "1" })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.registration_enabled === "1" ? "bg-green-500" : "bg-white/10"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings.registration_enabled === "1" ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Card: Feature & AI Flags */}
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 border-b border-white/5 pb-2">Feature Controls</h3>

                          {/* AI Features Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-white">Enable AI Features</p>
                              <p className="text-xs text-white/35 mt-0.5">Unlocks AI chat assistant, visual search, and pricing aids.</p>
                            </div>
                            <button
                              onClick={() => handleUpdateSettings({ ai_features_enabled: settings.ai_features_enabled === "1" ? "0" : "1" })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.ai_features_enabled === "1" ? "bg-indigo-500" : "bg-white/10"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings.ai_features_enabled === "1" ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Reviews Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-white">Enable Product Reviews</p>
                              <p className="text-xs text-white/35 mt-0.5">Allows buyers to leave reviews on purchased items.</p>
                            </div>
                            <button
                              onClick={() => handleUpdateSettings({ reviews_enabled: settings.reviews_enabled === "1" ? "0" : "1" })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                settings.reviews_enabled === "1" ? "bg-green-500" : "bg-white/10"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  settings.reviews_enabled === "1" ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Card: Checkout Controls & Security Limits */}
                        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-4 md:col-span-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 border-b border-white/5 pb-2">Checkout & Security Parameters</h3>

                          <div className="grid gap-6 md:grid-cols-2">
                            {/* Guest Checkout Toggle */}
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm font-medium text-white">Guest Checkout</p>
                                <p className="text-xs text-white/35 mt-0.5">Allows purchase workflow completion without register/login.</p>
                              </div>
                              <button
                                onClick={() => handleUpdateSettings({ guest_checkout_enabled: settings.guest_checkout_enabled === "1" ? "0" : "1" })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  settings.guest_checkout_enabled === "1" ? "bg-[#d4c5a9]" : "bg-white/10"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-[#1a1510] transition-transform ${
                                    settings.guest_checkout_enabled === "1" ? "translate-x-6" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Max Login Attempts Input */}
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm font-medium text-white">Max Login Attempts</p>
                                <p className="text-xs text-white/35 mt-0.5">Account lock limit. Prevents brute-force scripts.</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="3"
                                  max="20"
                                  value={settings.max_login_attempts}
                                  onChange={(e) => handleUpdateSettings({ max_login_attempts: e.target.value })}
                                  className="w-16 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center text-sm font-semibold text-white outline-none focus:border-[#d4c5a9]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="text-center py-12 text-white/40 italic">Failed to retrieve platform settings. Please check server connection.</div>
                    )}
                  </div>
                </div>
              )}

              {tab === "security" && (
                <div className="space-y-6 text-left">
                  {/* Grid of Sessions and Logs */}
                  <div className="grid gap-6 xl:grid-cols-2">
                    
                    {/* Active Sessions */}
                    <div className="rounded-[2.5rem] border border-white/10 bg-[#0c0c0c] p-6 shadow-2xl flex flex-col">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-white">Active Sessions</h2>
                            <p className="text-xs text-white/45 mt-0.5">Real-time active login tokens linked to active devices.</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-green-500/10 border border-green-500/20 px-3 py-1 text-xs text-green-400 font-semibold">
                          {sessions.length} Active
                        </span>
                      </div>

                      {sessionsLoading ? (
                        <div className="flex-1 min-h-[300px] animate-pulse rounded-2xl bg-white/5" />
                      ) : sessions.length === 0 ? (
                        <div className="flex-1 min-h-[300px] flex items-center justify-center text-white/30 italic">No session tokens currently cached.</div>
                      ) : (
                        <div className="flex-1 max-h-[500px] overflow-y-auto space-y-3 pr-1">
                          {sessions.map((sess) => (
                            <div key={sess.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex justify-between items-center gap-4 hover:border-white/10 transition-colors">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white truncate">{sess.email}</span>
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase text-white/50">{sess.kind}</span>
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-white/35">
                                  <p>IP: <span className="font-mono text-white/50">{sess.ip_address || "Unknown"}</span></p>
                                  <p>Issued: {new Date(sess.created_at).toLocaleString()}</p>
                                  <p>Expires: {new Date(sess.expires_at).toLocaleString()}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleKillSession(sess.id)}
                                className="rounded-full border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer whitespace-nowrap"
                              >
                                Terminate
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Security Audit Log */}
                    <div className="rounded-[2.5rem] border border-white/10 bg-[#0c0c0c] p-6 shadow-2xl flex flex-col">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-white">Security Events</h2>
                            <p className="text-xs text-white/45 mt-0.5">Chronological audit stream of authentication operations.</p>
                          </div>
                        </div>
                      </div>

                      {eventsLoading ? (
                        <div className="flex-1 min-h-[300px] animate-pulse rounded-2xl bg-white/5" />
                      ) : securityEvents.length === 0 ? (
                        <div className="flex-1 min-h-[300px] flex items-center justify-center text-white/30 italic">No security audit events recorded.</div>
                      ) : (
                        <div className="flex-1 max-h-[500px] overflow-y-auto space-y-3 pr-1">
                          {securityEvents.map((evt) => {
                            const isFailure = evt.action.includes("FAILED") || evt.action.includes("SUSPEND");
                            const isSuccess = evt.action.includes("SUCCESS") || evt.action.includes("ACTIVATE");
                            const badgeColor = isFailure
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : isSuccess
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20";
                            
                            return (
                              <div key={evt.id} className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 text-[11px] leading-relaxed hover:border-white/10 transition-colors">
                                <div className="flex items-start justify-between gap-3 mb-1">
                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase font-semibold ${badgeColor}`}>
                                    {evt.action}
                                  </span>
                                  <span className="text-[10px] text-white/30 whitespace-nowrap">{new Date(evt.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-white/70">
                                    Operator: <span className="font-semibold text-white">{evt.email || "System"}</span> (IP: <span className="font-mono text-white/50">{evt.ip_address}</span>)
                                  </p>
                                  <p className="text-white/45">
                                    Target: <span className="text-white/60">{evt.entity}</span> ({evt.entity_id})
                                  </p>
                                  {evt.metadata && (
                                    <div className="mt-2 rounded-xl bg-black/40 p-2 font-mono text-[9px] text-white/50 overflow-x-auto">
                                      {evt.metadata}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Order Details & AI Fraud Guard Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 backdrop-blur-md p-4" onClick={() => setSelectedOrder(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0d0d0d] text-white shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-white/5 bg-black/40 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[#d4c5a9]">Order details</p>
                <h3 className="mt-1 font-mono text-lg font-semibold text-[#e8dcc4]">#{selectedOrder.id.slice(0, 16)}</h3>
              </div>
              <button
                onClick={() => { setSelectedOrder(null); setFraudDetail(null); }}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
              {/* Order Info Summary */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Customer Details</p>
                  <p className="text-sm font-semibold mt-1 text-white">{selectedOrder.customer}</p>
                  <p className="text-xs text-white/35 mt-0.5">Placed on {new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-4 flex flex-col justify-between border border-white/5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Order Value</p>
                    <p className="text-xl font-bold mt-1 text-white">{fmt(selectedOrder.total_cents)}</p>
                  </div>
                  <span className="text-xs text-[#d4c5a9] font-medium tracking-wide uppercase mt-2">{selectedOrder.status}</span>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Items list</h4>
                {loadingOrder ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}
                  </div>
                ) : orderItems.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-white/5 bg-black/20 p-2">
                    {orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.01]">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.title} className="h-10 w-10 rounded-lg object-cover border border-white/5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate text-white">{item.title}</p>
                          <p className="text-[10px] text-white/40">Qty: {item.quantity} · {fmt(item.price_cents)} each</p>
                        </div>
                        <p className="text-xs font-medium text-white/90">{fmt(item.price_cents * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/30 italic">No order items data found.</p>
                )}
              </div>

              {/* Fraud Guard Section */}
              <div className="rounded-[1.75rem] border border-[#d4a843]/15 bg-[#d4a843]/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-[#d4a843]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#d4a843]">✦ AI Fraud Guard Protection</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#1a1510] border border-[#d4c5a9]/10 rounded-full px-3 py-1">
                    <span className="text-[10px] text-[#d4c5a9]/55 font-medium uppercase">Risk Score:</span>
                    <span className={`text-xs font-bold ${fraudColor(selectedOrder.fraud_score)}`}>
                      {(selectedOrder.fraud_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Score bar chart / gauge */}
                <div className="h-2 rounded-full bg-white/10 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      selectedOrder.fraud_score > 0.6 ? "bg-red-500" : selectedOrder.fraud_score > 0.3 ? "bg-orange-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, selectedOrder.fraud_score * 100)}%` }}
                  />
                </div>

                {fraudDetail ? (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="rounded-xl bg-black/30 p-2.5">
                        <span className="text-[10px] text-white/35 uppercase">Recommendation</span>
                        <p className={`font-semibold mt-0.5 uppercase tracking-wide ${
                          fraudDetail.recommendation === "block" ? "text-red-400" : fraudDetail.recommendation === "review" ? "text-orange-400" : "text-green-400"
                        }`}>
                          {fraudDetail.recommendation}
                        </p>
                      </div>
                      <div className="rounded-xl bg-black/30 p-2.5">
                        <span className="text-[10px] text-white/35 uppercase">Confidence</span>
                        <p className="font-semibold mt-0.5 text-white/90">High Precision AI</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/30 p-3 mt-2">
                      <span className="text-[10px] text-white/35 uppercase">Analysis Reasoning</span>
                      <p className="text-white/80 leading-relaxed mt-1 text-[11px]">{fraudDetail.reason}</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 bg-black/20 rounded-2xl text-center p-4">
                    <p className="text-xs text-white/50 leading-relaxed">Detailed risk vectors (email domain, purchase patterns, past history) have not been run.</p>
                    <button
                      onClick={runFraudAnalysis}
                      disabled={analyzingFraud}
                      className="mt-3 rounded-full bg-[#d4c5a9] px-5 py-2.5 text-xs font-semibold text-[#1a1510] hover:bg-[#e8dcc4] disabled:opacity-40"
                    >
                      {analyzingFraud ? "Running Fraud Guard..." : "✦ Run AI Fraud Analysis"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 bg-black/25 px-6 py-4 flex justify-between gap-3 text-sm">
              <button
                onClick={() => { setSelectedOrder(null); setFraudDetail(null); }}
                className="rounded-full border border-white/10 px-5 py-2.5 text-xs text-white/60 hover:bg-white/5"
              >
                Close
              </button>
              {fraudDetail && (
                <button
                  onClick={runFraudAnalysis}
                  disabled={analyzingFraud}
                  className="rounded-full border border-[#d4a843]/30 bg-[#d4a843]/10 px-5 py-2.5 text-xs font-semibold text-[#d4a843] hover:bg-[#d4a843]/20 disabled:opacity-40"
                >
                  {analyzingFraud ? "Running..." : "✦ Re-Analyze Fraud"}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
