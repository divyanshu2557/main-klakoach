import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
export const customerRouter = Router();
// GET /api/customer/profile
customerRouter.get("/profile", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const profile = await db
        .prepare(`SELECT c.id, c.name, a.email
         FROM customers c
         JOIN auth_accounts a ON a.id = c.auth_account_id
         WHERE c.auth_account_id = ?`)
        .get(user.sub);
    if (!profile) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const addresses = await db
        .prepare(`SELECT id, line1, city, country, postal, created_at
         FROM addresses WHERE customer_id = ? ORDER BY created_at ASC`)
        .all(profile.id);
    const orderCountRow = await db
        .prepare("SELECT COUNT(*) as c FROM orders WHERE customer_id = ?")
        .get(profile.id);
    const spendRow = await db
        .prepare("SELECT COALESCE(SUM(total_cents), 0) as s FROM orders WHERE customer_id = ? AND status IN ('PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED')")
        .get(profile.id);
    res.json({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        addresses,
        orderCount: orderCountRow.c,
        lifetimeSpendCents: spendRow.s,
    });
});
// PATCH /api/customer/profile
customerRouter.patch("/profile", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim() === "") {
        res.status(400).json({ error: "VALIDATION_ERROR", detail: "name must be a non-empty string" });
        return;
    }
    const result = await db
        .prepare("UPDATE customers SET name = ?, updated_at = datetime('now') WHERE auth_account_id = ?")
        .run(name.trim(), user.sub);
    if (result.changes === 0) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    res.json({ message: "Profile updated" });
});
// POST /api/customer/addresses
customerRouter.post("/addresses", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const { line1, city, country, postal } = req.body;
    if (!line1 || typeof line1 !== "string" || line1.trim() === "" ||
        !city || typeof city !== "string" || city.trim() === "" ||
        !country || typeof country !== "string" || country.trim() === "" ||
        !postal || typeof postal !== "string" || postal.trim() === "") {
        res.status(400).json({ error: "VALIDATION_ERROR", detail: "line1, city, country, and postal are required" });
        return;
    }
    const customer = await db
        .prepare("SELECT id FROM customers WHERE auth_account_id = ?")
        .get(user.sub);
    if (!customer) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const id = uuid();
    await db.prepare(`INSERT INTO addresses(id, customer_id, line1, city, country, postal, created_at)
       VALUES(?, ?, ?, ?, ?, ?, datetime('now'))`).run(id, customer.id, line1.trim(), city.trim(), country.trim(), postal.trim());
    const newAddress = await db
        .prepare("SELECT id, line1, city, country, postal, created_at FROM addresses WHERE id = ?")
        .get(id);
    res.status(201).json(newAddress);
});
// GET /api/customer/orders
customerRouter.get("/orders", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    const customer = await db
        .prepare("SELECT id FROM customers WHERE auth_account_id = ?")
        .get(user.sub);
    if (!customer) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    const orders = await db
        .prepare(`SELECT o.id,
                o.status,
                o.total_cents,
                o.created_at,
                COUNT(oi.id) AS item_count,
                p.status AS payment_status
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN payments p ON p.order_id = o.id
         WHERE o.customer_id = ?
         GROUP BY o.id, p.status
         ORDER BY o.created_at DESC`)
        .all(customer.id);
    res.json(orders);
});
