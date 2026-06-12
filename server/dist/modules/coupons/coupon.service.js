import { db } from '../../db/index.js';
/**
 * Validates a coupon code and computes the discount amount.
 *
 * @param code - The coupon code to look up
 * @param originalTotalCents - The pre-discount order total in cents
 * @returns `{ discountCents, couponId }` on success
 * @throws Error with `.code === 'COUPON_INVALID'` if the coupon is not found or inactive
 * @throws Error with `.code === 'COUPON_EXPIRED'` if the coupon has passed its expiry date
 */
export async function validateAndApplyCoupon(code, originalTotalCents) {
    const coupon = await db
        .prepare('SELECT * FROM coupons WHERE code = ?')
        .get(code);
    if (!coupon || coupon.active === 0) {
        const err = new Error('Coupon not found or inactive');
        err.code = 'COUPON_INVALID';
        throw err;
    }
    if (coupon.expires_at !== null && coupon.expires_at < new Date().toISOString()) {
        const err = new Error('Coupon has expired');
        err.code = 'COUPON_EXPIRED';
        throw err;
    }
    const discountCents = Math.floor(originalTotalCents * coupon.percent_off / 100);
    return { discountCents, couponId: coupon.id };
}
