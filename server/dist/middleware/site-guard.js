import { db } from "../db/index.js";
import { verifyAccess } from "../security/tokens.js";
/**
 * Site Guard Middleware
 * - Maintenance mode: returns 503 for non-admin, non-health requests
 * - Registration gate: blocks /api/auth/register when disabled (handled in auth router)
 * - AI features gate: blocks /api/ai/* when disabled
 */
async function getSetting(key) {
    const row = (await db.prepare("SELECT value FROM site_settings WHERE key = ?").get(key));
    return row?.value ?? "";
}
function isAdmin(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return false;
    try {
        const payload = verifyAccess(header.slice(7));
        return payload.role === "ADMIN";
    }
    catch {
        return false;
    }
}
export async function siteGuard(req, res, next) {
    // Always allow health checks
    if (req.path === "/health") {
        next();
        return;
    }
    // ── Maintenance Mode ───────────────────────────────────────────────────
    if ((await getSetting("maintenance_mode")) === "true") {
        // Allow admin users through
        if (isAdmin(req)) {
            next();
            return;
        }
        // Allow auth endpoints so admins can login
        if (req.path.startsWith("/api/auth/login") || req.path.startsWith("/api/auth/refresh")) {
            next();
            return;
        }
        res.status(503).json({
            error: "MAINTENANCE_MODE",
            message: "The platform is currently under maintenance. Please try again later.",
        });
        return;
    }
    // ── AI Features Gate ───────────────────────────────────────────────────
    if (req.path.startsWith("/api/ai") && (await getSetting("ai_features_enabled")) === "false") {
        res.status(503).json({
            error: "AI_DISABLED",
            message: "AI features are temporarily disabled by the administrator.",
        });
        return;
    }
    next();
}
