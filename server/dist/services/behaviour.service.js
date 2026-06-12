import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
/**
 * Records a browse event for a customer and enforces a 500-row cap per customer.
 * All DB operations use the better-sqlite3 synchronous API.
 */
export async function recordEvent(params) {
    const { customerId, eventType, productId, query } = params;
    // Insert the new browse_events row
    await db.prepare(`INSERT INTO browse_events (id, customer_id, product_id, event_type, query, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`).run(uuid(), customerId, productId ?? null, eventType, query ?? null);
    // Count total browse_events rows for this customer
    const row = db
        .prepare(`SELECT COUNT(*) AS cnt FROM browse_events WHERE customer_id = ?`)
        .get(customerId);
    // If count exceeds 500, prune oldest rows to keep only the 500 most recent
    if (row.cnt > 500) {
        await db.prepare(`DELETE FROM browse_events
       WHERE customer_id = ?
         AND id NOT IN (
           SELECT id FROM browse_events
           WHERE customer_id = ?
           ORDER BY created_at DESC
           LIMIT 500
         )`).run(customerId, customerId);
    }
}
