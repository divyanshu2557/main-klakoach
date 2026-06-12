import { v4 as uuid } from 'uuid';
import { db } from '../../db/index.js';
// Module-level SSE connection pool: authAccountId → set of active Response objects
export const connectionPool = new Map();
async function broadcast(authAccountId, notification) {
    const connections = connectionPool.get(authAccountId);
    if (!connections || connections.size === 0)
        return;
    const frame = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
    const dead = [];
    for (const res of connections) {
        try {
            res.write(frame);
        }
        catch {
            // Connection is dead — mark for removal
            dead.push(res);
        }
    }
    // Clean up dead connections
    for (const res of dead) {
        connections.delete(res);
    }
    // Remove the entry entirely if no connections remain
    if (connections.size === 0) {
        connectionPool.delete(authAccountId);
    }
}
export const notificationService = {
    async create({ authAccountId, title, body }) {
        const id = uuid();
        await db.prepare(`INSERT INTO notifications (id, auth_account_id, title, body)
       VALUES (?, ?, ?, ?)`).run(id, authAccountId, title, body);
        const notification = (await db.prepare(`SELECT * FROM notifications WHERE id = ?`).get(id));
        await broadcast(authAccountId, notification);
    },
};
