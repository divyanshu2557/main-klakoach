import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db } from "../../db/index.js";
import { recordEvent } from "../../services/behaviour.service.js";
export const recommendationsRouter = Router();
const JWT_SECRET = process.env.JWT_ACCESS_SECRET ?? "klakoach_access_dev_secret_32chars!!";
// ── Optional auth helper ───────────────────────────────────────────────────────
// Returns the customer row if the Bearer token is valid, otherwise null.
function tryGetCustomer(authHeader) {
    if (!authHeader?.startsWith("Bearer "))
        return null;
    const token = authHeader.slice(7);
    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
    const customer = db
        .prepare("SELECT id FROM customers WHERE auth_account_id = ?")
        .get(payload.sub);
    if (!customer)
        return null;
    return { customerId: customer.id, authAccountId: payload.sub };
}
// ── Scoring helpers ────────────────────────────────────────────────────────────
function daysSince(createdAt) {
    const ms = Date.now() - new Date(createdAt).getTime();
    return ms / (1000 * 60 * 60 * 24);
}
function toProductResponse(row) {
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        price_cents: row.price_cents,
        image_url: row.image_url,
        category: row.category,
        category_slug: row.category_slug,
        artisan: row.artisan,
        stock: row.stock,
        avg_rating: row.avg_rating,
        review_count: row.review_count,
        created_at: row.created_at,
    };
}
function scoreProduct(product, categoryAffinity, maxAffinity, wishlistedIds) {
    const affinity = product.category_id ? (categoryAffinity[product.category_id] ?? 0) : 0;
    const wishlisted = wishlistedIds.has(product.id) ? 0.3 : 0;
    const newness = daysSince(product.created_at) < 14 ? 0.15 : 0;
    return ((affinity / maxAffinity) * 0.5 +
        (product.avg_rating / 5) * 0.25 +
        (product.review_count > 10 ? 0.1 : 0) +
        wishlisted +
        newness);
}
// ── POST /event ────────────────────────────────────────────────────────────────
// Optional auth; silently returns 204 if not authenticated.
const EventBodySchema = z.object({
    eventType: z.enum(["VIEW", "CART_ADD", "SEARCH"]),
    productId: z.string().optional(),
    query: z.string().optional(),
});
recommendationsRouter.post("/event", async (req, res) => {
    const auth = tryGetCustomer(req.headers.authorization);
    if (!auth) {
        res.status(204).send();
        return;
    }
    const parsed = EventBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    recordEvent({
        customerId: auth.customerId,
        eventType: parsed.data.eventType,
        productId: parsed.data.productId,
        query: parsed.data.query,
    });
    res.status(204).send();
});
// ── GET / ──────────────────────────────────────────────────────────────────────
// Optional auth; returns personalised or fallback recommendations.
recommendationsRouter.get("/", async (req, res) => {
    const auth = tryGetCustomer(req.headers.authorization);
    const productId = req.query.productId;
    // ── Similarity mode (productId provided) ────────────────────────────────────
    if (productId) {
        const target = db
            .prepare(`SELECT p.id, p.category_id, p.price_cents
         FROM products p
         WHERE p.id = ? AND p.status = 'ACTIVE'`)
            .get(productId);
        if (!target) {
            res.json([]);
            return;
        }
        const priceTolerance = Math.floor(target.price_cents * 0.5);
        const similar = db
            .prepare(`SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.created_at,
                c.name as category, c.slug as category_slug,
                a.studio_name as artisan,
                COALESCE(i.quantity - i.reserved, 0) as stock,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                COUNT(DISTINCT r.id) as review_count
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN artisans a ON a.id = p.artisan_id
         LEFT JOIN inventory i ON i.product_id = p.id
         LEFT JOIN reviews r ON r.product_id = p.id
         WHERE p.status = 'ACTIVE'
           AND p.category_id = ?
           AND p.id != ?
           AND ABS(p.price_cents - ?) <= ?
           AND COALESCE(i.quantity - i.reserved, 0) > 0
         GROUP BY p.id, c.name, c.slug, a.studio_name, i.quantity, i.reserved
         ORDER BY avg_rating DESC
         LIMIT 8`)
            .all(target.category_id, target.id, target.price_cents, priceTolerance);
        res.json(similar.map(toProductResponse));
        return;
    }
    // ── Personalised path ────────────────────────────────────────────────────────
    if (auth) {
        // Check how many browse events this customer has
        const eventCount = db
            .prepare("SELECT COUNT(*) as cnt FROM browse_events WHERE customer_id = ?")
            .get(auth.customerId).cnt;
        if (eventCount >= 5) {
            // Fetch last 500 browse events
            const browseEvents = db
                .prepare(`SELECT be.product_id, be.event_type, be.created_at, p.category_id
           FROM browse_events be
           LEFT JOIN products p ON p.id = be.product_id
           WHERE be.customer_id = ?
           ORDER BY be.created_at DESC
           LIMIT 500`)
                .all(auth.customerId);
            // Build categoryAffinity map (VIEW and CART_ADD events)
            const categoryAffinity = {};
            for (const ev of browseEvents) {
                if ((ev.event_type === "VIEW" || ev.event_type === "CART_ADD") &&
                    ev.category_id) {
                    categoryAffinity[ev.category_id] = (categoryAffinity[ev.category_id] ?? 0) + 1;
                }
            }
            const maxAffinity = Math.max(...Object.values(categoryAffinity), 1);
            // Fetch wishlist product IDs
            const wishlistRows = db
                .prepare("SELECT product_id FROM wishlists WHERE customer_id = ?")
                .all(auth.customerId);
            const wishlistedIds = new Set(wishlistRows.map((r) => r.product_id));
            // Fetch purchased product IDs to exclude
            const purchasedRows = db
                .prepare(`SELECT DISTINCT oi.product_id
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE o.customer_id = ?
             AND o.status IN ('PAID','FULFILLING','SHIPPED','DELIVERED')`)
                .all(auth.customerId);
            const purchasedIds = new Set(purchasedRows.map((r) => r.product_id));
            // Fetch all ACTIVE in-stock products
            const allProducts = db
                .prepare(`SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.created_at,
                  p.category_id,
                  c.name as category, c.slug as category_slug,
                  a.studio_name as artisan,
                  (i.quantity - i.reserved) as stock,
                  COALESCE(AVG(r.rating), 0) as avg_rating,
                  COUNT(r.id) as review_count
           FROM products p
           JOIN categories c ON c.id = p.category_id
           JOIN artisans a ON a.id = p.artisan_id
           LEFT JOIN inventory i ON i.product_id = p.id
           LEFT JOIN reviews r ON r.product_id = p.id
           WHERE p.status = 'ACTIVE' AND (i.quantity - i.reserved) > 0
           GROUP BY p.id, p.category_id, c.name, c.slug, a.studio_name, i.quantity, i.reserved`)
                .all();
            // Score and filter
            const scored = allProducts
                .filter((p) => !purchasedIds.has(p.id))
                .map((p) => ({
                product: p,
                score: scoreProduct(p, categoryAffinity, maxAffinity, wishlistedIds),
            }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 12);
            res.json(scored.map((s) => toProductResponse(s.product)));
            return;
        }
    }
    // ── Fallback: top 12 by avg_rating (unauthenticated or <5 events) ───────────
    const fallback = db
        .prepare(`SELECT p.id, p.title, p.slug, p.price_cents, p.image_url, p.created_at,
              c.name as category, c.slug as category_slug,
              a.studio_name as artisan,
              COALESCE(i.quantity - i.reserved, 0) as stock,
              COALESCE(AVG(r.rating), 0) as avg_rating,
              COUNT(DISTINCT r.id) as review_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN artisans a ON a.id = p.artisan_id
       LEFT JOIN inventory i ON i.product_id = p.id
       LEFT JOIN reviews r ON r.product_id = p.id
       WHERE p.status = 'ACTIVE' AND COALESCE(i.quantity - i.reserved, 0) > 0
       GROUP BY p.id, c.name, c.slug, a.studio_name, i.quantity, i.reserved
       ORDER BY avg_rating DESC
       LIMIT 12`)
        .all();
    res.json(fallback.map(toProductResponse));
});
