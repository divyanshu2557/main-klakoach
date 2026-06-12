import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { authRouter } from "./modules/auth/router.js";
import { productsRouter } from "./modules/products/router.js";
import { ordersRouter } from "./modules/orders/router.js";
import { artisanRouter } from "./modules/artisan/router.js";
import { adminRouter } from "./modules/admin/router.js";
import { contentRouter } from "./modules/content/router.js";
import { aiRouter } from "./modules/ai/router.js";
import { customerRouter } from "./modules/customer/router.js";
import { realtimeRouter } from "./modules/realtime/router.js";
import { paymentsRouter, webhookRouter } from "./modules/payments/router.js";
import { recommendationsRouter } from "./modules/recommendations/router.js";
import { siteGuard } from "./middleware/site-guard.js";
import { startReconciliationJob } from "./services/reconciliation.job.js";
import { dbReady } from "./db/index.js";
const app = express();
const PORT = process.env.PORT ?? 4000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// ── Production environment validation ─────────────────────────────────────────
if (IS_PRODUCTION) {
    const required = ["DATABASE_URL", "JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        console.error(`\n🔴 FATAL: Missing required environment variables: ${missing.join(", ")}\n`);
        process.exit(1);
    }
}
// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: IS_PRODUCTION ? undefined : false,
}));
// ── CORS ──────────────────────────────────────────────────────────────────────
// In production: use explicit CORS_ORIGINS whitelist
// In development: allow localhost origins
const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (IS_PRODUCTION && corsOrigins?.length) {
            // Strict whitelist in production
            callback(null, corsOrigins.includes(origin));
        }
        else {
            // Dev: allow any localhost
            const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
            callback(null, allowed.test(origin));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
// ── Webhook route MUST be mounted before express.json() ───────────────────────
// The stripe webhook handler uses express.raw() inline to capture the raw body.
// Registering it here ensures the global JSON parser never touches this path.
app.use("/api/webhooks", webhookRouter);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// ── Request ID for traceability ───────────────────────────────────────────────
app.use((_req, res, next) => {
    const id = crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    next();
});
// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
// Strict rate limiter for auth
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, message: { error: "TOO_MANY_REQUESTS" } });
// ── Site Guard — maintenance mode, feature gates ──────────────────────────────
app.use(siteGuard);
// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({
    status: "ok",
    ts: new Date().toISOString(),
    env: IS_PRODUCTION ? "production" : "development",
}));
// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/content", contentRouter);
app.use("/api/studio", artisanRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ai", aiRouter);
app.use("/api/customer", customerRouter);
app.use("/api/realtime", realtimeRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/payments", paymentsRouter);
// 404
app.use((_req, res) => res.status(404).json({ error: "NOT_FOUND" }));
// Global error handler — never leak stack traces in production
app.use((err, _req, res, _next) => {
    console.error("[ERROR]", IS_PRODUCTION ? err.message : err.stack);
    res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        ...(IS_PRODUCTION ? {} : { detail: err.message }),
    });
});
dbReady
    .then(() => {
    app.listen(PORT, () => {
        console.log(`\n🏺 klakoach API running → http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   Mode: ${IS_PRODUCTION ? "🔒 PRODUCTION" : "🔧 DEVELOPMENT"}\n`);
        // Start reconciliation job after server is listening and DB bootstrap is complete.
        startReconciliationJob();
    });
})
    .catch(() => {
    process.exit(1);
});
