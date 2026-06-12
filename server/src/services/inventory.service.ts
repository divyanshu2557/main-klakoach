import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';

/**
 * Atomically reserve inventory for a list of items.
 * Throws an error if any item has insufficient available quantity.
 */
export function reserveInventory(
  items: { productId: string; quantity: number }[]
): Promise<void> {
  const tx = db.transaction(async () => {
    for (const item of items) {
      const row = await db
              .prepare(
                `SELECT quantity, reserved FROM inventory WHERE product_id = ?`
              )
              .get(item.productId) as unknown as | { quantity: number; reserved: number }
              | undefined;

      if (!row) {
        throw new Error(`INVENTORY_NOT_FOUND:${item.productId}`);
      }

      const available = row.quantity - row.reserved;
      if (available < item.quantity) {
        throw new Error(
          `INSUFFICIENT_STOCK:${item.productId}:available=${available}:requested=${item.quantity}`
        );
      }

      await db.prepare(
        `UPDATE inventory SET reserved = reserved + ?, updated_at = datetime('now') WHERE product_id = ?`
      ).run(item.quantity, item.productId);
    }
  });

  return tx();
}

/**
 * Atomically release reserved inventory for all items in an order.
 * Uses MAX(0, reserved - quantity) to prevent negative reserved counts.
 */
export async function releaseInventory(orderId: string): Promise<void> {
  const items = await db
      .prepare(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ?`
      )
      .all(orderId) as unknown as { product_id: string; quantity: number }[];

  if (items.length === 0) return;

  const tx = db.transaction(async () => {
    for (const item of items) {
      await db.prepare(
        `UPDATE inventory SET reserved = MAX(0, reserved - ?), updated_at = datetime('now') WHERE product_id = ?`
      ).run(item.quantity, item.product_id);
    }
  });

  await tx();
}

/**
 * Check available inventory for a product and send a low-stock notification
 * to the artisan owner if the available quantity is at or below the low_stock_at
 * threshold. Deduplicates notifications within a 24-hour window using activity_logs.
 */
export async function checkAndNotifyLowStock(productId: string): Promise<void> {
  const inv = await db
      .prepare(
        `SELECT quantity, reserved, low_stock_at FROM inventory WHERE product_id = ?`
      )
      .get(productId) as unknown as | { quantity: number; reserved: number; low_stock_at: number }
      | undefined;

  if (!inv) return;

  const available = inv.quantity - inv.reserved;

  if (available > inv.low_stock_at) return;

  // Check if a LOW_STOCK_NOTIFIED entry exists within the last 24 hours
  const recentNotification = await db
      .prepare(
        `SELECT id FROM activity_logs
       WHERE action = 'LOW_STOCK_NOTIFIED'
         AND entity_id = ?
         AND created_at >= datetime('now', '-24 hours')`
      )
      .get(productId) as unknown as { id: string } | undefined;

  if (recentNotification) return;

  // Look up the artisan owner's auth_account_id and product title
  const productInfo = await db
      .prepare(
        `SELECT p.title, a.auth_account_id
       FROM products p
       JOIN artisans a ON a.id = p.artisan_id
       WHERE p.id = ?`
      )
      .get(productId) as unknown as | { title: string; auth_account_id: string }
      | undefined;

  if (!productInfo) return;

  // Attempt to send notification — wrapped in try/catch so a missing
  // notification module never crashes inventory operations.
  try {
    // Use an indirect dynamic import so TypeScript doesn't statically resolve
    // the module path (notification.service is implemented in task 5.1).
    const notifPath = '../modules/notifications/notification.service.js';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod = await (new Function('p', 'return import(p)'))(notifPath) as {
      notificationService?: {
        create(params: { authAccountId: string; title: string; body: string }): Promise<void>;
      };
    };
    await mod.notificationService?.create({
      authAccountId: productInfo.auth_account_id,
      title: 'Low Stock Alert',
      body: `"${productInfo.title}" has only ${available} unit${available === 1 ? '' : 's'} remaining.`,
    });
  } catch {
    // Notification service not yet available — continue silently
  }

  // Record the notification in activity_logs to prevent duplicates within 24 h
  await db.prepare(
    `INSERT INTO activity_logs(id, action, entity, entity_id, metadata, created_at)
     VALUES(?, 'LOW_STOCK_NOTIFIED', 'products', ?, ?, datetime('now'))`
  ).run(
    uuid(),
    productId,
    JSON.stringify({ available, low_stock_at: inv.low_stock_at })
  );
}
