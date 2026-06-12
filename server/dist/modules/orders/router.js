import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { releaseInventory } from "../../services/inventory.service.js";
export const ordersRouter = Router();
const CheckoutSchema = z.object({
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).min(1),
    couponCode: z.string().optional(),
});
// Fraud scoring: simple heuristic engine
function computeFraudScore(params) {
    let score = 0;
    if (params.totalCents > 50000_00)
        score += 0.25;
    if (params.itemCount > 10)
        score += 0.15;
    if (params.customerOrderCount === 0)
        score += 0.1;
    if (params.ip?.startsWith("10.") || params.ip?.startsWith("192.168."))
        score += 0.05;
    return Math.min(score, 1);
}
async function upsertShipping(params) {
    const existing = (await db.prepare("SELECT id FROM shipping WHERE order_id = ?").get(params.orderId));
    if (existing) {
        await db.prepare("UPDATE shipping SET carrier = ?, tracking_number = ?, status = 'SHIPPED', updated_at = datetime('now') WHERE id = ?").run(params.carrier, params.trackingNumber, existing.id);
        return;
    }
    await db.prepare("INSERT INTO shipping(id, order_id, carrier, tracking_number, status, updated_at) VALUES(?, ?, ?, ?, 'SHIPPED', datetime('now'))").run(uuid(), params.orderId, params.carrier, params.trackingNumber);
}
async function getCustomerIdForAccount(authAccountId) {
    const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(authAccountId));
    return customer?.id;
}
// Customer: checkout
ordersRouter.post("/checkout", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub));
    if (!customer) {
        res.status(403).json({ error: "CUSTOMER_PROFILE_MISSING" });
        return;
    }
    const { items } = parsed.data;
    // Validate stock and compute total
    let totalCents = 0;
    const resolvedItems = [];
    for (const item of items) {
        const product = await db.prepare(`SELECT p.id, p.price_cents, p.status, COALESCE(i.quantity - i.reserved, 0) as available
       FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ?`).get(item.productId);
        if (!product || product.status !== "ACTIVE") {
            res.status(400).json({ error: "PRODUCT_UNAVAILABLE", productId: item.productId });
            return;
        }
        if (product.available < item.quantity) {
            res.status(400).json({ error: "INSUFFICIENT_STOCK", productId: item.productId, available: product.available });
            return;
        }
        totalCents += product.price_cents * item.quantity;
        resolvedItems.push({ productId: item.productId, quantity: item.quantity, priceCents: product.price_cents });
    }
    const customerOrderCount = (await db.prepare("SELECT COUNT(*) as c FROM orders WHERE customer_id = ?").get(customer.id)).c;
    const fraudScore = computeFraudScore({ totalCents, itemCount: items.length, customerOrderCount, ip: req.ip ?? "" });
    const orderId = uuid();
    const tx = db.transaction(async () => {
        await db.prepare("INSERT INTO orders(id,customer_id,status,total_cents,fraud_score) VALUES(?,?,?,?,?)").run(orderId, customer.id, "PENDING", totalCents, fraudScore);
        for (const item of resolvedItems) {
            await db.prepare("INSERT INTO order_items(id,order_id,product_id,quantity,price_cents) VALUES(?,?,?,?,?)").run(uuid(), orderId, item.productId, item.quantity, item.priceCents);
            await db.prepare("UPDATE inventory SET reserved = reserved + ? WHERE product_id = ?").run(item.quantity, item.productId);
        }
        // Notify artisans
        for (const item of resolvedItems) {
            const artisanAccount = (await db.prepare(`SELECT a.auth_account_id FROM artisans a JOIN products p ON p.artisan_id = a.id WHERE p.id = ?`).get(item.productId));
            if (artisanAccount) {
                await db.prepare("INSERT INTO notifications(id,auth_account_id,title,body) VALUES(?,?,?,?)").run(uuid(), artisanAccount.auth_account_id, "New Order", `Order ${orderId.slice(0, 8)} placed for your product.`);
            }
        }
    });
    await tx();
    res.status(201).json({ orderId, totalCents, fraudScore, status: "PENDING" });
});
// Customer: list own orders
ordersRouter.get("/mine", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub));
    if (!customer) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const orders = await db.prepare(`SELECT o.id, o.status, o.total_cents, o.fraud_score, o.created_at,
            COUNT(oi.id) as item_count
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ? GROUP BY o.id ORDER BY o.created_at DESC`).all(customer.id);
    res.json(orders);
});
// Authenticated owner/admin: track order
ordersRouter.get("/track/:id", authenticate, async (req, res) => {
    const user = req.user;
    let order;
    if (user.role === "ADMIN") {
        order = (await db.prepare(`SELECT o.id, o.status, o.created_at, s.carrier, s.tracking_number
       FROM orders o
       LEFT JOIN shipping s ON s.order_id = o.id
       WHERE o.id = ?`).get(req.params.id));
    }
    else if (user.role === "CUSTOMER") {
        const customerId = await getCustomerIdForAccount(user.sub);
        if (!customerId) {
            res.status(404).json({ error: "NOT_FOUND" });
            return;
        }
        order = (await db.prepare(`SELECT o.id, o.status, o.created_at, s.carrier, s.tracking_number
       FROM orders o
       LEFT JOIN shipping s ON s.order_id = o.id
       WHERE o.id = ? AND o.customer_id = ?`).get(req.params.id, customerId));
    }
    else {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    res.json(order);
});
// Authenticated owner/admin: get receipt
ordersRouter.get("/:id/receipt", authenticate, async (req, res) => {
    const user = req.user;
    let order;
    if (user.role === "ADMIN") {
        order = (await db.prepare("SELECT id, status, total_cents, created_at FROM orders WHERE id = ?").get(req.params.id));
    }
    else if (user.role === "CUSTOMER") {
        const customerId = await getCustomerIdForAccount(user.sub);
        if (!customerId) {
            res.status(404).json({ error: "NOT_FOUND" });
            return;
        }
        order = (await db.prepare("SELECT id, status, total_cents, created_at FROM orders WHERE id = ? AND customer_id = ?").get(req.params.id, customerId));
    }
    else {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const items = await db.prepare(`SELECT oi.quantity, oi.price_cents, p.title
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`).all(req.params.id);
    res.json({ ...order, items });
});
// Authenticated owner/admin: check return eligibility
ordersRouter.get("/:id/return-eligibility", authenticate, async (req, res) => {
    const user = req.user;
    let order;
    if (user.role === "ADMIN") {
        order = (await db.prepare("SELECT id, status, created_at FROM orders WHERE id = ?").get(req.params.id));
    }
    else if (user.role === "CUSTOMER") {
        const customerId = await getCustomerIdForAccount(user.sub);
        if (!customerId) {
            res.status(404).json({ error: "NOT_FOUND" });
            return;
        }
        order = (await db.prepare("SELECT id, status, created_at FROM orders WHERE id = ? AND customer_id = ?").get(req.params.id, customerId));
    }
    else {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
    }
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const daysSinceOrder = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const returnWindowDays = 30;
    const daysRemaining = returnWindowDays - daysSinceOrder;
    const eligible = daysRemaining >= 0 && !["CANCELLED", "REFUNDED"].includes(order.status);
    res.json({
        id: order.id,
        status: order.status,
        eligible,
        daysRemaining: Math.max(0, daysRemaining),
        orderDate: order.created_at
    });
});
// Customer owner: request return
ordersRouter.post("/:id/return", authenticate, async (req, res) => {
    const user = req.user;
    if (user.role !== "CUSTOMER") {
        res.status(403).json({ error: "CUSTOMER_ONLY" });
        return;
    }
    const customerId = await getCustomerIdForAccount(user.sub);
    const order = (await db.prepare("SELECT id, status, created_at FROM orders WHERE id = ? AND customer_id = ?").get(req.params.id, customerId ?? ""));
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    // Must not already be returned/cancelled
    if (["CANCELLED", "REFUNDED", "RETURN_REQUESTED"].includes(order.status)) {
        res.status(400).json({ error: "INVALID_STATE" });
        return;
    }
    // Update status
    await db.prepare("UPDATE orders SET status = 'RETURN_REQUESTED', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    res.json({ success: true, status: "RETURN_REQUESTED" });
});
// Customer: order detail
ordersRouter.get("/:id", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const customer = (await db.prepare("SELECT id FROM customers WHERE auth_account_id = ?").get(user.sub));
    const order = (await db.prepare("SELECT * FROM orders WHERE id = ? AND customer_id = ?").get(req.params.id, customer?.id ?? ""));
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const items = await db.prepare(`SELECT oi.quantity, oi.price_cents, p.title, p.image_url, p.slug
     FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`).all(req.params.id);
    res.json({ ...order, items });
});
// Admin: update order status with transition validation
const VALID_TRANSITIONS = {
    PENDING: ["PAID", "CANCELLED"],
    PAID: ["FULFILLING", "REFUNDED"],
    FULFILLING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["REFUNDED"],
};
ordersRouter.patch("/:id/status", authenticate, requirePermission("orders:write"), async (req, res) => {
    const { status, trackingNumber, carrier } = req.body;
    const validStatuses = ["PENDING", "PAID", "FULFILLING", "SHIPPED", "DELIVERED", "REFUNDED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "INVALID_STATUS" });
        return;
    }
    const order = (await db.prepare("SELECT id, status, customer_id FROM orders WHERE id = ?").get(req.params.id));
    if (!order) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(status)) {
        res.status(422).json({ error: "INVALID_STATUS_TRANSITION", detail: `Cannot transition from ${order.status} to ${status}` });
        return;
    }
    // SHIPPED requires tracking info
    if (status === "SHIPPED") {
        if (!trackingNumber || !carrier) {
            res.status(400).json({ error: "TRACKING_REQUIRED", detail: "trackingNumber and carrier are required for SHIPPED status" });
            return;
        }
        await upsertShipping({ orderId: req.params.id, carrier, trackingNumber });
        // Notify customer
        const customer = (await db.prepare("SELECT auth_account_id FROM customers WHERE id = ?").get(order.customer_id));
        if (customer) {
            await db.prepare("INSERT INTO notifications(id,auth_account_id,title,body) VALUES(?,?,?,?)").run(uuid(), customer.auth_account_id, "Your order has shipped!", `Tracking: ${trackingNumber} via ${carrier}`);
        }
    }
    await db.prepare("UPDATE orders SET status=?,updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
    // Release reserved stock on cancel/refund via inventory service
    if (status === "CANCELLED" || status === "REFUNDED") {
        await releaseInventory(String(req.params.id));
    }
    res.json({ message: "Status updated" });
});
