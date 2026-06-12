import type { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../../db/index.js';

// Module-level SSE connection pool: authAccountId → set of active Response objects
export const connectionPool = new Map<string, Set<Response>>();

interface CreateNotificationParams {
  authAccountId: string;
  title: string;
  body: string;
}

interface Notification {
  id: string;
  auth_account_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

async function broadcast(authAccountId: string, notification: Notification): Promise<void> {
  const connections = connectionPool.get(authAccountId);
  if (!connections || connections.size === 0) return;

  const frame = `event: notification\ndata: ${JSON.stringify(notification)}\n\n`;
  const dead: Response[] = [];

  for (const res of connections) {
    try {
      res.write(frame);
    } catch {
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
  async create({ authAccountId, title, body }: CreateNotificationParams): Promise<void> {
    const id = uuid();

    await db.prepare(
      `INSERT INTO notifications (id, auth_account_id, title, body)
       VALUES (?, ?, ?, ?)`
    ).run(id, authAccountId, title, body);

    const notification = (await db.prepare(
          `SELECT * FROM notifications WHERE id = ?`
        ).get(id)) as unknown as Notification;

    await broadcast(authAccountId, notification);
  },
};
