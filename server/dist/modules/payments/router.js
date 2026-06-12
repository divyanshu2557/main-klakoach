import express, { Router } from "express";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { createCheckoutIntent, refundOrder, handleWebhookEvent, } from "./payment.service.js";
import { authenticate, requirePermission, } from "../../middleware/auth.js";
// ---------------------------------------------------------------------------
// paymentsRouter  — mounted at /api/payments
// ---------------------------------------------------------------------------
export const paymentsRouter = Router();
const CheckoutBodySchema = z.object({
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
    })).min(1),
    couponCode: z.string().trim().min(1).optional(),
    guestEmail: z.string().email().optional(),
});
// POST /api/payments/checkout
paymentsRouter.post("/checkout", authenticate, requirePermission("cart:checkout"), async (req, res) => {
    const user = req.user;
    // Look up customerId from customers table
    const customerRow = await db
        .prepare(`SELECT id FROM customers WHERE auth_account_id = ?`)
        .get(user.sub);
    if (!customerRow) {
        res.status(403).json({ error: "CUSTOMER_ONLY" });
        return;
    }
    const parsed = CheckoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const { items, couponCode, guestEmail } = parsed.data;
    try {
        const result = await createCheckoutIntent({
            customerId: customerRow.id,
            items,
            couponCode,
            guestEmail,
        });
        res.status(201).json(result);
    }
    catch (err) {
        const code = err.code;
        if (code === "PRODUCT_UNAVAILABLE" ||
            code === "INSUFFICIENT_STOCK" ||
            code === "COUPON_INVALID" ||
            code === "COUPON_EXPIRED") {
            res.status(400).json({ error: code });
            return;
        }
        console.error("[payments/checkout]", err);
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
});
// POST /api/payments/refund/:orderId
paymentsRouter.post("/refund/:orderId", authenticate, requirePermission("orders:write"), async (req, res) => {
    const user = req.user;
    const orderId = req.params.orderId;
    try {
        await refundOrder(orderId, user.sub);
        res.json({ success: true });
    }
    catch (err) {
        const code = err.code;
        if (code === "REFUND_NOT_ELIGIBLE") {
            res.status(422).json({ error: code });
            return;
        }
        if (code === "ORDER_NOT_FOUND") {
            res.status(404).json({ error: code });
            return;
        }
        console.error("[payments/refund]", err);
        res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
    }
});
// ---------------------------------------------------------------------------
// webhookRouter  — mounted at /api/webhooks
// Webhook route uses express.raw to receive the raw body for signature
// verification — this must be registered BEFORE the global express.json()
// parser touches the /api/webhooks path.
// ---------------------------------------------------------------------------
import crypto from "crypto";
export const webhookRouter = Router();
// POST /api/webhooks/razorpay
webhookRouter.post("/razorpay", 
// Inline raw-body parser overrides global JSON parser for this route
express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
    if (!sig) {
        await db.prepare(`INSERT INTO activity_logs (id, auth_account_id, action, entity, entity_id, created_at)
         VALUES (?, NULL, 'WEBHOOK_SIGNATURE_FAILED', 'webhooks', 'razorpay', datetime('now'))`).run(uuid());
        res.status(400).json({ error: "MISSING_SIGNATURE" });
        return;
    }
    const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");
    if (sig !== expectedSig) {
        console.error("[webhook] Signature verification failed");
        await db.prepare(`INSERT INTO activity_logs (id, auth_account_id, action, entity, entity_id, created_at)
         VALUES (?, NULL, 'WEBHOOK_SIGNATURE_FAILED', 'webhooks', 'razorpay', datetime('now'))`).run(uuid());
        res.status(400).json({ error: "WEBHOOK_SIGNATURE_FAILED" });
        return;
    }
    let event;
    try {
        event = JSON.parse(req.body.toString("utf-8"));
    }
    catch (err) {
        res.status(400).json({ error: "INVALID_JSON" });
        return;
    }
    try {
        await handleWebhookEvent(event);
    }
    catch (err) {
        console.error("[webhook] handleWebhookEvent error:", err);
        // Return 500 so Razorpay will retry
        res.status(500).json({ error: "WEBHOOK_PROCESSING_ERROR" });
        return;
    }
    res.status(200).json({ received: true });
});
