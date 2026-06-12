import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { razorpay } from './razorpay.client.js';
import { releaseInventory } from './inventory.service.js';
/**
 * Reconciles stale PENDING orders that are older than 30 minutes.
 * Checks Razorpay for the actual payment status and updates accordingly.
 */
export async function runReconciliation() {
    const staleOrders = await db.prepare(`SELECT o.id, o.status, o.created_at
     FROM orders o
     WHERE o.status = 'PENDING'
       AND o.created_at < datetime('now', '-30 minutes')`).all();
    if (staleOrders.length === 0)
        return;
    console.log(`[reconciliation] Found ${staleOrders.length} stale PENDING order(s)`);
    for (const order of staleOrders) {
        const payment = (await db.prepare(`SELECT id, provider_payment_id, status FROM payments WHERE order_id = ?`).get(order.id));
        if (!payment) {
            // No payment record — cancel the order directly
            await db.prepare(`UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`).run(order.id);
            await releaseInventory(order.id);
            console.log(`[reconciliation] Order ${order.id}: no payment found, cancelled`);
            continue;
        }
        try {
            const rzpOrder = await razorpay.orders.fetch(payment.provider_payment_id);
            if (rzpOrder.status === 'paid') {
                // Payment succeeded but webhook was missed — mark as PAID
                await db.prepare(`UPDATE payments SET status = 'SUCCEEDED' WHERE id = ?`).run(payment.id);
                await db.prepare(`UPDATE orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?`).run(order.id);
                // Decrement total quantity AND reserved (item is sold, no longer in stock)
                const items = (await db.prepare(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`).all(order.id));
                for (const item of items) {
                    await db.prepare(`UPDATE inventory
             SET quantity = MAX(0, quantity - ?),
                 reserved = MAX(0, reserved - ?),
                 updated_at = datetime('now')
             WHERE product_id = ?`).run(item.quantity, item.quantity, item.product_id);
                }
                console.log(`[reconciliation] Order ${order.id}: payment succeeded, marked PAID`);
            }
            else {
                // Since 30 minutes have passed and it's not paid (created or attempted), we cancel it
                await db.prepare(`UPDATE payments SET status = 'FAILED' WHERE id = ?`).run(payment.id);
                await db.prepare(`UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`).run(order.id);
                await releaseInventory(order.id);
                console.log(`[reconciliation] Order ${order.id}: payment ${rzpOrder.status}, cancelled`);
            }
        }
        catch (err) {
            // Razorpay API error — log and skip
            await db.prepare(`INSERT INTO activity_logs(id, auth_account_id, action, entity, entity_id, metadata, created_at)
         VALUES(?, NULL, 'RECONCILIATION_ERROR', 'orders', ?, ?, datetime('now'))`).run(uuid(), order.id, JSON.stringify({ error: err.message }));
            console.error(`[reconciliation] Order ${order.id}: Razorpay error — ${err.message}`);
        }
    }
}
/**
 * Starts the reconciliation job: runs once immediately, then every 5 minutes.
 */
export function startReconciliationJob() {
    // Run once on startup
    runReconciliation().catch((err) => console.error('[reconciliation] Startup run failed:', err));
    // Then every 5 minutes
    setInterval(() => {
        runReconciliation().catch((err) => console.error('[reconciliation] Scheduled run failed:', err));
    }, 5 * 60 * 1000);
    console.log('[reconciliation] Job scheduled (every 5 minutes)');
}
