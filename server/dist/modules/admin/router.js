import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { releaseInventory } from "../../services/inventory.service.js";
export const adminRouter = Router();
adminRouter.use(authenticate, requirePermission("analytics:read"));
const CatalogProductSchema = z.object({
    title: z.string().min(2),
    description: z.string().default(""),
    priceCents: z.number().int().positive(),
    categoryId: z.string().min(1),
    imageUrl: z.string().url().optional().default(""),
    stock: z.number().int().min(0).default(0),
    status: z.enum(["ACTIVE", "PENDING_REVIEW", "SUSPENDED", "ARCHIVED"]).default("ACTIVE"),
    featured: z.boolean().default(false),
    artisanId: z.string().min(1),
});
const CatalogCategorySchema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    sortOrder: z.number().int().default(0),
});
const CatalogArtisanSchema = z.object({
    studioName: z.string().min(2),
    story: z.string().default(""),
    approved: z.boolean().default(true),
    featured: z.boolean().default(false),
});
async function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
// Platform-wide analytics
adminRouter.get("/analytics", async (_req, res) => {
    const gmv = await db.prepare(`SELECT COALESCE(SUM(total_cents), 0) as total FROM orders WHERE status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')`).get();
    const orderStats = await db.prepare(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`).all();
    const topArtisans = await db.prepare(`SELECT a.studio_name, COUNT(DISTINCT p.id) as products,
            COALESCE(SUM(oi.quantity * oi.price_cents), 0) as revenue
     FROM artisans a
     LEFT JOIN products p ON p.artisan_id = a.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
     GROUP BY a.id ORDER BY revenue DESC LIMIT 10`).all();
    const topProducts = await db.prepare(`SELECT p.title, p.price_cents, COALESCE(SUM(oi.quantity), 0) as units_sold
     FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
     GROUP BY p.id ORDER BY units_sold DESC LIMIT 10`).all();
    const userCounts = await db.prepare(`SELECT kind, COUNT(*) as count FROM auth_accounts GROUP BY kind`).all();
    const fraudAlerts = await db.prepare(`SELECT o.id, o.fraud_score, o.total_cents, o.status, o.created_at, cu.name as customer
     FROM orders o JOIN customers cu ON cu.id = o.customer_id
     WHERE o.fraud_score > 0.3 ORDER BY o.fraud_score DESC LIMIT 20`).all();
    const recentActivity = await db.prepare(`SELECT al.action, al.entity, al.created_at, aa.email
     FROM activity_logs al LEFT JOIN auth_accounts aa ON aa.id = al.auth_account_id
     ORDER BY al.created_at DESC LIMIT 50`).all();
    const dailyRevenue = await db.prepare(`SELECT DATE(created_at) as date, SUM(total_cents) as revenue, COUNT(*) as orders
     FROM orders WHERE status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
     AND created_at >= datetime('now', '-30 days')
     GROUP BY DATE(created_at) ORDER BY date ASC`).all();
    res.json({ gmv: gmv.total, orderStats, topArtisans, topProducts, userCounts, fraudAlerts, recentActivity, dailyRevenue });
});
// Admin catalog controls
adminRouter.get("/catalog/products", async (_req, res) => {
    const products = await db.prepare(`SELECT p.id, p.title, p.slug, p.description, p.price_cents, p.status, p.featured,
            p.image_url, p.created_at, p.updated_at,
            c.id as category_id, c.name as category,
            a.id as artisan_id, a.studio_name as artisan,
            COALESCE(i.quantity, 0) as stock
     FROM products p
     JOIN categories c ON c.id = p.category_id
     JOIN artisans a ON a.id = p.artisan_id
     LEFT JOIN inventory i ON i.product_id = p.id
     ORDER BY p.created_at DESC`).all();
    res.json(products);
});
adminRouter.post("/catalog/products", requirePermission("inventory:write"), async (req, res) => {
    const parsed = CatalogProductSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const artisan = (await db.prepare("SELECT id FROM artisans WHERE id = ?").get(parsed.data.artisanId));
    const category = (await db.prepare("SELECT id FROM categories WHERE id = ?").get(parsed.data.categoryId));
    if (!artisan || !category) {
        res.status(404).json({ error: "RELATED_RECORD_MISSING" });
        return;
    }
    const id = uuid();
    const slug = `${slugify(parsed.data.title)}-${id.slice(0, 8)}`;
    await db.prepare(`INSERT INTO products(id,artisan_id,category_id,title,slug,description,price_cents,status,image_url,featured)
     VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id, artisan.id, category.id, parsed.data.title, slug, parsed.data.description, parsed.data.priceCents, parsed.data.status, parsed.data.imageUrl, parsed.data.featured ? 1 : 0);
    await db.prepare("INSERT INTO inventory(id,product_id,quantity) VALUES(?,?,?)").run(uuid(), id, parsed.data.stock);
    res.status(201).json({ id, slug });
});
adminRouter.patch("/catalog/products/:id", requirePermission("inventory:write"), async (req, res) => {
    const parsed = CatalogProductSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const product = (await db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id));
    if (!product) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (parsed.data.artisanId) {
        const artisan = (await db.prepare("SELECT id FROM artisans WHERE id = ?").get(parsed.data.artisanId));
        if (!artisan) {
            res.status(404).json({ error: "ARTISAN_NOT_FOUND" });
            return;
        }
        await db.prepare("UPDATE products SET artisan_id=?,updated_at=datetime('now') WHERE id=?").run(artisan.id, req.params.id);
    }
    if (parsed.data.categoryId) {
        const category = (await db.prepare("SELECT id FROM categories WHERE id = ?").get(parsed.data.categoryId));
        if (!category) {
            res.status(404).json({ error: "CATEGORY_NOT_FOUND" });
            return;
        }
        await db.prepare("UPDATE products SET category_id=?,updated_at=datetime('now') WHERE id=?").run(category.id, req.params.id);
    }
    if (parsed.data.title)
        await db.prepare("UPDATE products SET title=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.title, req.params.id);
    if (parsed.data.description !== undefined)
        await db.prepare("UPDATE products SET description=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.description, req.params.id);
    if (parsed.data.priceCents !== undefined)
        await db.prepare("UPDATE products SET price_cents=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.priceCents, req.params.id);
    if (parsed.data.imageUrl !== undefined)
        await db.prepare("UPDATE products SET image_url=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.imageUrl, req.params.id);
    if (parsed.data.status !== undefined)
        await db.prepare("UPDATE products SET status=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.status, req.params.id);
    if (parsed.data.featured !== undefined)
        await db.prepare("UPDATE products SET featured=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.featured ? 1 : 0, req.params.id);
    if (parsed.data.stock !== undefined)
        await db.prepare("UPDATE inventory SET quantity=?,updated_at=datetime('now') WHERE product_id=?").run(parsed.data.stock, req.params.id);
    res.json({ message: "Product updated" });
});
adminRouter.delete("/catalog/products/:id", requirePermission("inventory:write"), async (req, res) => {
    await db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ message: "Product deleted" });
});
adminRouter.get("/catalog/artisans", async (_req, res) => {
    const artisans = await db.prepare(`SELECT a.id, a.studio_name, a.story, a.approved, a.featured, a.created_at,
            aa.email,
            COUNT(DISTINCT p.id) as product_count,
            COUNT(DISTINCT af.id) as follower_count
     FROM artisans a
     JOIN auth_accounts aa ON aa.id = a.auth_account_id
     LEFT JOIN products p ON p.artisan_id = a.id
     LEFT JOIN artisan_follows af ON af.artisan_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`).all();
    res.json(artisans);
});
adminRouter.patch("/catalog/artisans/:id", requirePermission("users:write"), async (req, res) => {
    const parsed = CatalogArtisanSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const artisan = (await db.prepare("SELECT id FROM artisans WHERE id = ?").get(req.params.id));
    if (!artisan) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (parsed.data.studioName !== undefined)
        await db.prepare("UPDATE artisans SET studio_name=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.studioName, req.params.id);
    if (parsed.data.story !== undefined)
        await db.prepare("UPDATE artisans SET story=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.story, req.params.id);
    if (parsed.data.approved !== undefined)
        await db.prepare("UPDATE artisans SET approved=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.approved ? 1 : 0, req.params.id);
    if (parsed.data.featured !== undefined)
        await db.prepare("UPDATE artisans SET featured=?,updated_at=datetime('now') WHERE id=?").run(parsed.data.featured ? 1 : 0, req.params.id);
    res.json({ message: "Artisan updated" });
});
adminRouter.get("/catalog/categories", async (_req, res) => {
    const categories = await db.prepare(`SELECT c.id, c.name, c.slug, c.sort_order, COUNT(p.id) as product_count
     FROM categories c LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC`).all();
    res.json(categories);
});
adminRouter.post("/catalog/categories", requirePermission("users:write"), async (req, res) => {
    const parsed = CatalogCategorySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const id = uuid();
    await db.prepare("INSERT INTO categories(id,name,slug,sort_order) VALUES(?,?,?,?)")
        .run(id, parsed.data.name, slugify(parsed.data.slug), parsed.data.sortOrder);
    res.status(201).json({ id, slug: slugify(parsed.data.slug) });
});
adminRouter.patch("/catalog/categories/:id", requirePermission("users:write"), async (req, res) => {
    const parsed = CatalogCategorySchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const category = (await db.prepare("SELECT id FROM categories WHERE id = ?").get(req.params.id));
    if (!category) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    if (parsed.data.name !== undefined)
        await db.prepare("UPDATE categories SET name=? WHERE id=?").run(parsed.data.name, req.params.id);
    if (parsed.data.slug !== undefined)
        await db.prepare("UPDATE categories SET slug=? WHERE id=?").run(slugify(parsed.data.slug), req.params.id);
    if (parsed.data.sortOrder !== undefined)
        await db.prepare("UPDATE categories SET sort_order=? WHERE id=?").run(parsed.data.sortOrder, req.params.id);
    res.json({ message: "Category updated" });
});
adminRouter.delete("/catalog/categories/:id", requirePermission("users:write"), async (req, res) => {
    await db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
    res.json({ message: "Category deleted" });
});
// List all users
adminRouter.get("/users", requirePermission("users:write"), async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const kind = req.query.kind;
    const search = req.query.search;
    let where = "WHERE 1=1";
    const params = [];
    if (kind) {
        where += " AND kind = ?";
        params.push(kind);
    }
    if (search) {
        where += " AND email LIKE ?";
        params.push(`%${search}%`);
    }
    const total = (await db.prepare(`SELECT COUNT(*) as c FROM auth_accounts ${where}`).get(...params)).c;
    const users = await db.prepare(`SELECT id, email, kind, suspended, created_at FROM auth_accounts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
});
// Suspend / activate user — ACTUALLY enforces suspension
adminRouter.patch("/users/:id/status", requirePermission("users:write"), async (req, res) => {
    const { action } = req.body;
    if (!["suspend", "activate"].includes(action)) {
        res.status(400).json({ error: "INVALID_ACTION" });
        return;
    }
    const user = req.user;
    // Prevent admin from suspending themselves
    if (req.params.id === user.sub && action === "suspend") {
        res.status(400).json({ error: "CANNOT_SELF_SUSPEND" });
        return;
    }
    const suspended = action === "suspend" ? 1 : 0;
    await db.prepare("UPDATE auth_accounts SET suspended = ? WHERE id = ?").run(suspended, req.params.id);
    // On suspend: kill ALL active sessions for this user
    if (action === "suspend") {
        await db.prepare("DELETE FROM sessions WHERE auth_account_id = ?").run(req.params.id);
    }
    // Notify the user
    await db.prepare("INSERT INTO notifications(id,auth_account_id,title,body) VALUES(?,?,?,?)").run(uuid(), req.params.id, action === "suspend" ? "Account Suspended" : "Account Reactivated", action === "suspend"
        ? "Your account has been suspended. Contact support for more information."
        : "Your account has been reactivated. You can now log in again.");
    await db.prepare("INSERT INTO activity_logs(id,auth_account_id,action,entity,entity_id,ip_address) VALUES(?,?,?,?,?,?)").run(uuid(), user.sub, `ADMIN_${action.toUpperCase()}`, "auth_accounts", req.params.id, req.ip ?? "");
    res.json({ message: `User ${action}d` });
});
// Artisan approvals
adminRouter.get("/artisans/pending", async (_req, res) => {
    const pending = await db.prepare(`SELECT a.id, a.studio_name, a.story, a.created_at, aa.email
     FROM artisans a JOIN auth_accounts aa ON aa.id = a.auth_account_id
     WHERE a.approved = 0 ORDER BY a.created_at ASC`).all();
    res.json(pending);
});
adminRouter.patch("/artisans/:id/approve", requirePermission("users:write"), async (req, res) => {
    const { approved } = req.body;
    await db.prepare("UPDATE artisans SET approved=? WHERE id=?").run(approved ? 1 : 0, req.params.id);
    const artisan = (await db.prepare("SELECT auth_account_id FROM artisans WHERE id = ?").get(req.params.id));
    if (artisan) {
        await db.prepare("INSERT INTO notifications(id,auth_account_id,title,body) VALUES(?,?,?,?)").run(uuid(), artisan.auth_account_id, approved ? "Studio Approved!" : "Application Update", approved ? "Your artisan studio has been approved. You can now list products." : "Your application requires additional review.");
    }
    res.json({ message: approved ? "Approved" : "Revoked" });
});
// Product moderation
adminRouter.get("/products/review", async (_req, res) => {
    const products = await db.prepare(`SELECT p.id, p.title, p.price_cents, p.status, p.created_at, a.studio_name as artisan
     FROM products p JOIN artisans a ON a.id = p.artisan_id
     WHERE p.status = 'PENDING_REVIEW' ORDER BY p.created_at ASC`).all();
    res.json(products);
});
adminRouter.patch("/products/:id/status", requirePermission("users:write"), async (req, res) => {
    const { status } = req.body;
    const valid = ["ACTIVE", "SUSPENDED", "ARCHIVED", "PENDING_REVIEW"];
    if (!valid.includes(status)) {
        res.status(400).json({ error: "INVALID_STATUS" });
        return;
    }
    await db.prepare("UPDATE products SET status=?,updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    res.json({ message: "Product status updated" });
});
// All orders
adminRouter.get("/orders", requirePermission("orders:read"), async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const highFraud = req.query.highFraud === "true";
    let where = "WHERE 1=1";
    const params = [];
    if (status) {
        where += " AND o.status = ?";
        params.push(status);
    }
    if (highFraud) {
        where += " AND o.fraud_score > 0.3";
    }
    const total = (await db.prepare(`SELECT COUNT(*) as c FROM orders o ${where}`).get(...params)).c;
    const orders = await db.prepare(`SELECT o.id, o.status, o.total_cents, o.fraud_score, o.created_at,
            cu.name as customer, COUNT(oi.id) as item_count
     FROM orders o JOIN customers cu ON cu.id = o.customer_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
});
// ── Site Settings ─────────────────────────────────────────────────────────────
adminRouter.get("/settings", requirePermission("admin:settings"), async (_req, res) => {
    const rows = (await db.prepare("SELECT key, value, updated_at FROM site_settings ORDER BY key").all());
    const settings = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json({ settings, updatedAt: rows[0]?.updated_at });
});
adminRouter.patch("/settings", requirePermission("admin:settings"), async (req, res) => {
    const user = req.user;
    const updates = req.body;
    const allowedKeys = ["maintenance_mode", "registration_enabled", "ai_features_enabled", "guest_checkout_enabled", "reviews_enabled", "max_login_attempts"];
    const stmt = await db.prepare("UPDATE site_settings SET value = ?, updated_at = datetime('now') WHERE key = ?");
    const entries = Object.entries(updates).filter(([k]) => allowedKeys.includes(k));
    if (!entries.length) {
        res.status(400).json({ error: "NO_VALID_SETTINGS" });
        return;
    }
    const tx = db.transaction(async () => {
        for (const [key, value] of entries) {
            await stmt.run(String(value), key);
        }
    });
    tx();
    // Log each setting change
    for (const [key, value] of entries) {
        await db.prepare("INSERT INTO activity_logs(id,auth_account_id,action,entity,entity_id,metadata,ip_address) VALUES(?,?,?,?,?,?,?)").run(uuid(), user.sub, "SETTINGS_CHANGED", "site_settings", key, JSON.stringify({ key, value }), req.ip ?? "");
    }
    res.json({ message: "Settings updated", updated: entries.length });
});
// ── Security: Active Sessions ─────────────────────────────────────────────────
adminRouter.get("/security/sessions", requirePermission("security:read"), async (_req, res) => {
    const sessions = await db.prepare(`SELECT s.id, s.auth_account_id, s.created_at, s.expires_at, s.ip_address,
            aa.email, aa.kind
     FROM sessions s
     JOIN auth_accounts aa ON aa.id = s.auth_account_id
     WHERE s.expires_at > datetime('now')
     ORDER BY s.created_at DESC
     LIMIT 100`).all();
    res.json(sessions);
});
adminRouter.delete("/security/sessions/:id", requirePermission("security:read"), async (req, res) => {
    const user = req.user;
    const session = (await db.prepare("SELECT id, auth_account_id FROM sessions WHERE id = ?").get(req.params.id));
    if (!session) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    await db.prepare("DELETE FROM sessions WHERE id = ?").run(req.params.id);
    await db.prepare("INSERT INTO activity_logs(id,auth_account_id,action,entity,entity_id,ip_address) VALUES(?,?,?,?,?,?)").run(uuid(), user.sub, "ADMIN_SESSION_KILLED", "sessions", req.params.id, req.ip ?? "");
    res.json({ message: "Session terminated" });
});
// ── Security: Recent Security Events ──────────────────────────────────────────
adminRouter.get("/security/events", requirePermission("security:read"), async (_req, res) => {
    const events = await db.prepare(`SELECT al.id, al.action, al.entity, al.entity_id, al.ip_address, al.created_at, al.metadata,
            aa.email
     FROM activity_logs al
     LEFT JOIN auth_accounts aa ON aa.id = al.auth_account_id
     WHERE al.action IN ('LOGIN', 'LOGIN_FAILED', 'LOGIN_BLOCKED_SUSPENDED', 'REGISTER', 'ADMIN_SUSPEND', 'ADMIN_ACTIVATE', 'ADMIN_SESSION_KILLED', 'SETTINGS_CHANGED', 'REFRESH_TOKEN_MISMATCH', 'LOGOUT')
     ORDER BY al.created_at DESC
     LIMIT 100`).all();
    res.json(events);
});
// ── Task 8.1: Financial Analytics ─────────────────────────────────────────────
adminRouter.get("/financials", requirePermission("analytics:read"), async (req, res) => {
    // Default to last 30 days when from/to absent
    const to = req.query.to || new Date().toISOString();
    const from = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // GMV: sum of paid/fulfilling/shipped/delivered orders
    const gmvRow = await db.prepare(`SELECT COALESCE(SUM(total_cents), 0) as gmv, COUNT(*) as transaction_count
     FROM orders
     WHERE status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
       AND created_at BETWEEN ? AND ?`).get(from, to);
    const gmvCents = gmvRow.gmv;
    const transactionCount = gmvRow.transaction_count;
    // Refund total
    const refundsRow = await db.prepare(`SELECT COALESCE(SUM(total_cents), 0) as refunds
     FROM orders
     WHERE status = 'REFUNDED'
       AND created_at BETWEEN ? AND ?`).get(from, to);
    const refundsCents = refundsRow.refunds;
    // Razorpay fee estimate: 2% of GMV
    const razorpayFeesEstimateCents = Math.floor(gmvCents * 0.02);
    // Artisan payouts disbursed (status='PAID')
    const payoutsRow = await db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) as payouts FROM artisan_payouts WHERE status = 'PAID'`).get();
    const payoutsDisbursedCents = payoutsRow.payouts;
    // Net revenue
    const netRevenueCents = gmvCents - refundsCents - razorpayFeesEstimateCents - payoutsDisbursedCents;
    // Per-artisan breakdown
    const perArtisan = await db.prepare(`SELECT
       a.studio_name as studioName,
       COALESCE(SUM(oi.quantity * oi.price_cents), 0) as totalRevenueCents,
       COALESCE(SUM(oi.quantity), 0) as unitsSold,
       (
         SELECT COALESCE(ap2.status, 'NONE')
         FROM artisan_payouts ap2
         WHERE ap2.artisan_id = a.id
         ORDER BY ap2.created_at DESC
         LIMIT 1
       ) as payoutStatus
     FROM artisans a
     LEFT JOIN products p ON p.artisan_id = a.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
       AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')
       AND o.created_at BETWEEN ? AND ?
     GROUP BY a.id
     ORDER BY totalRevenueCents DESC`).all(from, to);
    res.json({
        gmvCents,
        refundsCents,
        razorpayFeesEstimateCents,
        payoutsDisbursedCents,
        netRevenueCents,
        perArtisan,
    });
});
// ── Task 8.2: Admin Order Detail ───────────────────────────────────────────────
adminRouter.get("/orders/:id", requirePermission("orders:read"), async (req, res) => {
    const order = (await db.prepare(`SELECT o.id, o.status, o.total_cents, o.fraud_score, o.created_at, o.updated_at,
            cu.name as customerName
     FROM orders o
     JOIN customers cu ON cu.id = o.customer_id
     WHERE o.id = ?`).get(req.params.id));
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const items = await db.prepare(`SELECT p.title, oi.quantity, oi.price_cents, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`).all(req.params.id);
    const payment = (await db.prepare(`SELECT provider, status, amount_cents FROM payments WHERE order_id = ?`).get(req.params.id));
    const shipping = (await db.prepare(`SELECT carrier, tracking_number as trackingNumber, status FROM shipping WHERE order_id = ?`).get(req.params.id));
    res.json({ ...order, items, payment: payment ?? null, shipping: shipping ?? null });
});
// ── Task 8.4: Bulk Order Status Update ────────────────────────────────────────
const VALID_TRANSITIONS = {
    PENDING: ["PAID", "CANCELLED"],
    PAID: ["FULFILLING", "REFUNDED"],
    FULFILLING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["REFUNDED"],
};
adminRouter.patch("/orders/bulk", requirePermission("orders:write"), async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
        res.status(400).json({ error: "VALIDATION_ERROR", detail: "orders array is required" });
        return;
    }
    if (orders.length > 50) {
        res.status(400).json({ error: "VALIDATION_ERROR", detail: "Maximum 50 orders per bulk request" });
        return;
    }
    const results = [];
    for (const item of orders) {
        try {
            const existing = (await db.prepare("SELECT id, status FROM orders WHERE id = ?").get(item.id));
            if (!existing) {
                results.push({ id: item.id, success: false, error: "NOT_FOUND" });
                continue;
            }
            const allowedTransitions = VALID_TRANSITIONS[existing.status];
            if (!allowedTransitions || !allowedTransitions.includes(item.status)) {
                results.push({ id: item.id, success: false, error: "INVALID_STATUS_TRANSITION" });
                continue;
            }
            if (item.status === "SHIPPED") {
                if (!item.trackingNumber || !item.carrier) {
                    results.push({ id: item.id, success: false, error: "TRACKING_REQUIRED" });
                    continue;
                }
                // Upsert shipping record
                await db.prepare(`INSERT OR REPLACE INTO shipping(id, order_id, carrier, tracking_number, status, updated_at)
           VALUES(COALESCE((SELECT id FROM shipping WHERE order_id = ?), ?), ?, ?, ?, 'SHIPPED', datetime('now'))`).run(item.id, uuid(), item.id, item.carrier, item.trackingNumber);
            }
            await db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?").run(item.status, item.id);
            if (item.status === "CANCELLED" || item.status === "REFUNDED") {
                await releaseInventory(item.id);
            }
            results.push({ id: item.id, success: true });
        }
        catch (err) {
            results.push({ id: item.id, success: false, error: "INTERNAL_ERROR" });
        }
    }
    res.json({ results });
});
// ── Task 8.5: Inactive Admins ─────────────────────────────────────────────────
adminRouter.get("/security/inactive-admins", requirePermission("security:read"), async (_req, res) => {
    const inactiveAdmins = await db.prepare(`SELECT aa.id, aa.email, aa.created_at
     FROM auth_accounts aa
     WHERE aa.kind = 'ADMIN'
       AND NOT EXISTS (
         SELECT 1 FROM activity_logs al
         WHERE al.auth_account_id = aa.id
           AND al.action = 'LOGIN'
           AND al.created_at > datetime('now', '-30 days')
       )
     ORDER BY aa.created_at ASC`).all();
    res.json(inactiveAdmins);
});
// ── Task 8.6: Payout Management ───────────────────────────────────────────────
adminRouter.patch("/payouts/:artisanId", requirePermission("analytics:read"), async (req, res) => {
    const user = req.user;
    // Update most recent PENDING payout to PROCESSING
    const result = await db.prepare(`UPDATE artisan_payouts
     SET status = 'PROCESSING', updated_at = datetime('now')
     WHERE artisan_id = ?
       AND status = 'PENDING'
       AND id = (
         SELECT id FROM artisan_payouts
         WHERE artisan_id = ? AND status = 'PENDING'
         ORDER BY created_at DESC
         LIMIT 1
       )`).run(req.params.artisanId, req.params.artisanId);
    if (result.changes === 0) {
        res.status(404).json({ error: "NOT_FOUND", detail: "No PENDING payout found for this artisan" });
        return;
    }
    // Log to activity_logs
    await db.prepare(`INSERT INTO activity_logs(id, auth_account_id, action, entity, entity_id, ip_address)
     VALUES(?, ?, 'PAYOUT_INITIATED', 'artisan_payouts', ?, ?)`).run(uuid(), user.sub, req.params.artisanId, req.ip ?? "");
    res.json({ message: "Payout marked as processing" });
});
