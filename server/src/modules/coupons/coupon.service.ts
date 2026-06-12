import { db } from '../../db/index.js';

interface CouponRow {
  id: string;
  code: string;
  percent_off: number;
  active: number;
  expires_at: string | null;
}

/**
 * Validates a coupon code and computes the discount amount.
 *
 * @param code - The coupon code to look up
 * @param originalTotalCents - The pre-discount order total in cents
 * @returns `{ discountCents, couponId }` on success
 * @throws Error with `.code === 'COUPON_INVALID'` if the coupon is not found or inactive
 * @throws Error with `.code === 'COUPON_EXPIRED'` if the coupon has passed its expiry date
 */
export async function validateAndApplyCoupon(
  code: string,
  originalTotalCents: number
): Promise<{ discountCents: number; couponId: string }> {
  const coupon = await db
      .prepare('SELECT * FROM coupons WHERE code = ?')
      .get(code) as unknown as CouponRow | undefined;

  if (!coupon || coupon.active === 0) {
    const err = new Error('Coupon not found or inactive') as Error & { code: string };
    err.code = 'COUPON_INVALID';
    throw err;
  }

  if (coupon.expires_at !== null && coupon.expires_at < new Date().toISOString()) {
    const err = new Error('Coupon has expired') as Error & { code: string };
    err.code = 'COUPON_EXPIRED';
    throw err;
  }

  const discountCents = Math.floor(originalTotalCents * coupon.percent_off / 100);

  return { discountCents, couponId: coupon.id };
}
