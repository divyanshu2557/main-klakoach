import { Router } from "express";
import type { Request, Response } from "express";
import { connectionPool } from "../notifications/notification.service.js";
import { verifyAccess } from "../../security/tokens.js";

export const realtimeRouter = Router();

realtimeRouter.get("/events", async (req: Request, res: Response) => {
  // ── Connection cap ─────────────────────────────────────────────────────────
  let totalConnections = 0;
  for (const set of connectionPool.values()) {
    totalConnections += set.size;
  }
  if (totalConnections >= 500) {
    res.set("Retry-After", "5");
    res.status(503).json({ error: "CONNECTION_LIMIT_EXCEEDED" });
    return;
  }

  // ── SSE headers ────────────────────────────────────────────────────────────
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.status(200);
  res.flushHeaders();

  // ── JWT verification via query param ───────────────────────────────────────
  const token = req.query["token"] as string | undefined;
  if (!token) {
    res.write('event: error\ndata: {"code":"AUTH_FAILED"}\n\n');
    res.end();
    return;
  }

  let authAccountId: string;
  try {
    const payload = verifyAccess(token);
    authAccountId = payload.sub;
  } catch {
    res.write('event: error\ndata: {"code":"AUTH_FAILED"}\n\n');
    res.end();
    return;
  }

  // ── Register connection in pool ────────────────────────────────────────────
  if (!connectionPool.has(authAccountId)) {
    connectionPool.set(authAccountId, new Set());
  }
  connectionPool.get(authAccountId)!.add(res);

  // ── Send connected event ───────────────────────────────────────────────────
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);

  // ── Heartbeat every 30s ────────────────────────────────────────────────────
  const hb = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(hb);
    }
  }, 30000);

  // ── Cleanup on client disconnect ───────────────────────────────────────────
  req.on("close", async () => {
    const pool = connectionPool.get(authAccountId);
    if (pool) {
      pool.delete(res);
      if (pool.size === 0) {
        connectionPool.delete(authAccountId);
      }
    }
    clearInterval(hb);
  });
});
