import { v4 as uuid } from 'uuid';
import { db } from '../../db/index.js';
import { razorpay } from '../../services/razorpay.client.js';
import { validateAndApplyCoupon } from '../coupons/coupon.service.js';
import { releaseInventory } from '../../services/inventory.service.js';
import { notificationService } from '../notifications/notification.service.js';
// ---------------------------------------------------------------------------
// createCheckoutIntent
// ---------------------------------------------------------------------------
export async function createCheckoutIntent(params) {
    const { customerId, items, couponCode, guestEmail } = params;
    if (!items || items.length === 0) {
        throw Object.assign(new Error('Cart is empty'), { code: 'EMPTY_CART' });
    }
    // Validate items and compute total
    let totalCents = 0;
    const validatedItems = [];
    for (const item of items) {
        const product = await db
            .prepare(`SELECT id, status, price_cents, artisan_id, title FROM products WHERE id = ?`)
            .get(item.productId);
        if (!product || product.status !== 'ACTIVE') {
            throw Object.assign(new Error(`Product ${item.productId} is not available`), { code: 'PRODUCT_UNAVAILABLE' });
        }
        const inv = await db
            .prepare(`SELECT quantity, reserved FROM inventory WHERE product_id = ?`)
            .get(item.productId);
        const available = inv ? inv.quantity - inv.reserved : 0;
        if (available < item.quantity) {
            throw Object.assign(new Error(`Insufficient stock for product ${item.productId}: available=${available}, requested=${item.quantity}`), { code: 'INSUFFICIENT_STOCK' });
        }
        totalCents += product.price_cents * item.quantity;
        validatedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            priceCents: product.price_cents,
            artisanId: product.artisan_id,
            title: product.title,
        });
    }
    // Apply coupon if provided
    let discountCents = 0;
    let couponId;
    if (couponCode) {
        const couponResult = await validateAndApplyCoupon(couponCode, totalCents);
        discountCents = couponResult.discountCents;
        couponId = couponResult.couponId;
    }
    const chargeAmount = totalCents - discountCents;
    // Atomic DB transaction: insert order + order_items + reserve inventory
    const orderId = uuid();
    const insertOrderAndItems = db.transaction(async () => {
        // Insert order
        await db.prepare(`INSERT INTO orders (id, customer_id, status, total_cents, fraud_score, coupon_code, discount_cents, guest_email)
       VALUES (?, ?, 'PENDING', ?, 0, ?, ?, ?)`).run(orderId, customerId, totalCents, couponCode ?? null, discountCents, guestEmail ?? null);
        // Insert order items and reserve inventory
        for (const item of validatedItems) {
            await db.prepare(`INSERT INTO order_items (id, order_id, product_id, quantity, price_cents)
         VALUES (?, ?, ?, ?, ?)`).run(uuid(), orderId, item.productId, item.quantity, item.priceCents);
            await db.prepare(`UPDATE inventory SET reserved = reserved + ?, updated_at = datetime('now') WHERE product_id = ?`).run(item.quantity, item.productId);
        }
    });
    await insertOrderAndItems();
    // Create Razorpay Order
    let rzpOrder;
    try {
        rzpOrder = await razorpay.orders.create({
            amount: chargeAmount,
            currency: 'INR',
            receipt: orderId,
        });
    }
    catch (err) {
        // Roll back the order and inventory reservations on Razorpay failure
        await db.transaction(async () => {
            for (const item of validatedItems) {
                await db.prepare(`UPDATE inventory SET reserved = MAX(0, reserved - ?), updated_at = datetime('now') WHERE product_id = ?`).run(item.quantity, item.productId);
            }
            await db.prepare(`DELETE FROM order_items WHERE order_id = ?`).run(orderId);
            await db.prepare(`DELETE FROM orders WHERE id = ?`).run(orderId);
        })();
        throw err;
    }
    // Insert payment row
    await db.prepare(`INSERT INTO payments (id, order_id, provider, provider_payment_id, status, amount_cents)
     VALUES (?, ?, 'razorpay', ?, 'REQUIRES_ACTION', ?)`).run(uuid(), orderId, rzpOrder.id, chargeAmount);
    return {
        clientSecret: rzpOrder.id, // Reusing clientSecret field to pass razorpay order ID to frontend
        orderId,
        amountCents: chargeAmount,
    };
}
// ---------------------------------------------------------------------------
// refundOrder
// ---------------------------------------------------------------------------
export async function refundOrder(orderId, adminAccountId) {
    // Fetch order
    const order = await db
        .prepare(`SELECT id, status, customer_id FROM orders WHERE id = ?`)
        .get(orderId);
    if (!order) {
        throw Object.assign(new Error(`Order ${orderId} not found`), { code: 'ORDER_NOT_FOUND' });
    }
    if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
        throw Object.assign(new Error(`Order ${orderId} is not eligible for refund (status: ${order.status})`), { code: 'REFUND_NOT_ELIGIBLE' });
    }
    // Fetch payment row
    const payment = await db
        .prepare(`SELECT id, order_id, provider_payment_id, status, amount_cents FROM payments WHERE order_id = ?`)
        .get(orderId);
    if (!payment) {
        throw Object.assign(new Error(`No payment found for order ${orderId}`), { code: 'PAYMENT_NOT_FOUND' });
    }
    // Issue Razorpay refund
    try {
        // We need the payment ID to refund. provider_payment_id stores the Razorpay order ID.
        const payments = await razorpay.orders.fetchPayments(payment.provider_payment_id);
        const successfulPayment = payments.items.find((p) => p.status === 'captured');
        if (!successfulPayment) {
            throw new Error("No captured payment found for this order in Razorpay");
        }
        await razorpay.payments.refund(successfulPayment.id, {
            amount: payment.amount_cents,
        });
    }
    catch (err) {
        throw Object.assign(new Error(`Razorpay refund failed: ${err.message}`), { code: 'REFUND_FAILED' });
    }
    // Update DB status
    await db.prepare(`UPDATE payments SET status = 'REFUNDED' WHERE id = ?`).run(payment.id);
    await db.prepare(`UPDATE orders SET status = 'REFUNDED', updated_at = datetime('now') WHERE id = ?`).run(orderId);
    // Release reserved inventory (releases reserved counts for cancelled/refunded orders)
    await releaseInventory(orderId);
    // Log to activity_logs
    await db.prepare(`INSERT INTO activity_logs (id, auth_account_id, action, entity, entity_id, created_at)
     VALUES (?, ?, 'ORDER_REFUNDED', 'orders', ?, datetime('now'))`).run(uuid(), adminAccountId, orderId);
    // Notify the customer
    const customer = await db
        .prepare(`SELECT auth_account_id FROM customers WHERE id = ?`)
        .get(order.customer_id);
    if (customer) {
        await notificationService.create({
            authAccountId: customer.auth_account_id,
            title: 'Refund Initiated',
            body: `Your refund of ₹${(payment.amount_cents / 100).toFixed(2)} has been initiated.`,
        });
    }
}
// ---------------------------------------------------------------------------
// handleWebhookEvent
// ---------------------------------------------------------------------------
export async function handleWebhookEvent(event) {
    switch (event.event) {
        case 'payment.captured': {
            const orderId = event.payload.payment.entity.order_id;
            if (orderId)
                await _handlePaymentSucceeded(orderId);
            break;
        }
        case 'payment.failed': {
            const orderId = event.payload.payment.entity.order_id;
            if (orderId)
                await _handlePaymentFailed(orderId);
            break;
        }
        case 'refund.processed': {
            // The refund entity might not always have order_id readily available on the top level,
            // but usually the payment entity has it.
            const paymentId = event.payload.refund.entity.payment_id;
            if (paymentId)
                await _handleChargeRefunded(paymentId);
            break;
        }
        default:
            // Unhandled event type — no-op
            break;
    }
}
// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------
async function _handlePaymentSucceeded(razorpayOrderId) {
    // Idempotency check
    const payment = await db
        .prepare(`SELECT id, order_id, status FROM payments WHERE provider_payment_id = ?`)
        .get(razorpayOrderId);
    if (!payment)
        return; // Unknown payment — ignore
    if (payment.status === 'SUCCEEDED') {
        return; // Already processed
    }
    const orderId = payment.order_id;
    // Fetch order items for inventory update
    const items = await db
        .prepare(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`)
        .all(orderId);
    // Atomic: update payments + orders + decrement inventory (quantity - reserved)
    await db.transaction(async () => {
        await db.prepare(`UPDATE payments SET status = 'SUCCEEDED' WHERE id = ?`).run(payment.id);
        await db.prepare(`UPDATE orders SET status = 'PAID', updated_at = datetime('now') WHERE id = ?`).run(orderId);
        // On PAID: decrement total quantity AND reserved (item is sold, no longer in stock)
        for (const item of items) {
            await db.prepare(`UPDATE inventory
         SET quantity = MAX(0, quantity - ?),
             reserved = MAX(0, reserved - ?),
             updated_at = datetime('now')
         WHERE product_id = ?`).run(item.quantity, item.quantity, item.product_id);
        }
    })();
    const order = await db
        .prepare(`SELECT id, customer_id FROM orders WHERE id = ?`)
        .get(orderId);
    if (!order)
        return;
    // Notify customer
    const customer = await db
        .prepare(`SELECT auth_account_id FROM customers WHERE id = ?`)
        .get(order.customer_id);
    if (customer) {
        await notificationService.create({
            authAccountId: customer.auth_account_id,
            title: 'Payment Confirmed',
            body: `Your payment has been confirmed. Your order is now being processed.`,
        });
    }
    // Notify each unique artisan
    const artisanAuthAccounts = await db
        .prepare(`SELECT DISTINCT ar.auth_account_id
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN artisans ar ON ar.id = p.artisan_id
       WHERE oi.order_id = ?`)
        .all(orderId);
    for (const artisan of artisanAuthAccounts) {
        await notificationService.create({
            authAccountId: artisan.auth_account_id,
            title: 'New Paid Order',
            body: `You have a new paid order (${orderId}). Please prepare it for shipping.`,
        });
    }
}
async function _handlePaymentFailed(razorpayOrderId) {
    const payment = await db
        .prepare(`SELECT id, order_id, status FROM payments WHERE provider_payment_id = ?`)
        .get(razorpayOrderId);
    if (!payment)
        return;
    const orderId = payment.order_id;
    await db.prepare(`UPDATE payments SET status = 'FAILED' WHERE id = ?`).run(payment.id);
    await db.prepare(`UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`).run(orderId);
    // Release reserved inventory
    await releaseInventory(orderId);
}
async function _handleChargeRefunded(paymentId) {
    // Try to find the payment by fetching it from Razorpay to get the order ID, or assume we recorded the payment_id somewhere.
    // Actually, Razorpay returns payment details. Let's fetch the payment to find the Razorpay Order ID.
    let razorpayOrderId;
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        razorpayOrderId = payment.order_id;
    }
    catch {
        return;
    }
    if (!razorpayOrderId)
        return;
    const paymentRow = await db
        .prepare(`SELECT id, order_id, status FROM payments WHERE provider_payment_id = ?`)
        .get(razorpayOrderId);
    if (!paymentRow)
        return;
    const orderId = paymentRow.order_id;
    await db.prepare(`UPDATE payments SET status = 'REFUNDED' WHERE id = ?`).run(paymentRow.id);
    await db.prepare(`UPDATE orders SET status = 'REFUNDED', updated_at = datetime('now') WHERE id = ?`).run(orderId);
    // Release reserved inventory
    await releaseInventory(orderId);
}
