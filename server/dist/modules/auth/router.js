import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import { hashPassword, verifyPassword, signAccess, signRefresh, verifyRefresh, hashRefreshToken } from "../../security/tokens.js";
import { authenticate } from "../../middleware/auth.js";
export const authRouter = Router();
const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    kind: z.enum(["CUSTOMER", "ARTISAN"]),
    studioName: z.string().optional(),
});
const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});
async function logActivity(authAccountId, action, entity, entityId, ip) {
    await db.prepare("INSERT INTO activity_logs(id,auth_account_id,action,entity,entity_id,ip_address) VALUES(?,?,?,?,?,?)").run(uuid(), authAccountId, action, entity, entityId ?? null, ip ?? null);
}
// Helper: check if registration is enabled via site_settings
async function isRegistrationEnabled() {
    const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'registration_enabled'").get();
    return row?.value !== "false";
}
authRouter.post("/register", async (req, res) => {
    // Check site setting: registration enabled
    if (!(await isRegistrationEnabled())) {
        res.status(403).json({ error: "REGISTRATION_DISABLED", message: "New registrations are currently disabled by the administrator." });
        return;
    }
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
        return;
    }
    const { password, name, kind, studioName } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const existing = await db.prepare("SELECT id FROM auth_accounts WHERE email = ?").get(email);
    if (existing) {
        res.status(409).json({ error: "EMAIL_TAKEN" });
        return;
    }
    const passwordHash = await hashPassword(password);
    const accountId = uuid();
    const profileId = uuid();
    const tx = db.transaction(async () => {
        await db.prepare("INSERT INTO auth_accounts(id,email,password_hash,kind) VALUES(?,?,?,?)").run(accountId, email, passwordHash, kind);
        if (kind === "CUSTOMER") {
            await db.prepare("INSERT INTO customers(id,auth_account_id,name) VALUES(?,?,?)").run(profileId, accountId, name);
        }
        else {
            await db.prepare("INSERT INTO artisans(id,auth_account_id,studio_name,story,approved) VALUES(?,?,?,?,0)").run(profileId, accountId, studioName ?? name, "");
        }
    });
    await tx();
    await logActivity(accountId, "REGISTER", "auth_accounts", accountId, req.ip);
    res.status(201).json({ message: "Account created" });
});
authRouter.post("/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "VALIDATION_ERROR" });
        return;
    }
    const email = parsed.data.email.toLowerCase();
    const { password } = parsed.data;
    // ── Account lockout check ────────────────────────────────────────────
    const maxAttemptsRow = (await db.prepare("SELECT value FROM site_settings WHERE key = 'max_login_attempts'").get());
    const maxAttempts = parseInt(maxAttemptsRow?.value ?? "10", 10);
    const failedCount = (await db.prepare(`SELECT COUNT(*) as c FROM activity_logs
     WHERE action = 'LOGIN_FAILED' AND entity = 'auth_accounts'
       AND ip_address = ? AND created_at >= datetime('now', '-15 minutes')`).get(req.ip ?? "")).c;
    if (failedCount >= maxAttempts) {
        res.status(423).json({ error: "ACCOUNT_LOCKED", message: "Too many failed attempts. Try again in 15 minutes." });
        return;
    }
    const account = (await db.prepare("SELECT id, password_hash, kind, suspended FROM auth_accounts WHERE email = ?").get(email));
    if (!account || !(await verifyPassword(account.password_hash, password))) {
        await logActivity(null, "LOGIN_FAILED", "auth_accounts", undefined, req.ip);
        res.status(401).json({ error: "INVALID_CREDENTIALS" });
        return;
    }
    // ── Suspension check ────────────────────────────────────────────────────
    if (account.suspended) {
        await logActivity(account.id, "LOGIN_BLOCKED_SUSPENDED", "auth_accounts", account.id, req.ip);
        res.status(403).json({ error: "ACCOUNT_SUSPENDED", message: "Your account has been suspended. Contact support." });
        return;
    }
    let artisanId;
    if (account.kind === "ARTISAN") {
        const a = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(account.id));
        artisanId = a?.id;
    }
    const sessionId = uuid();
    const refreshToken = signRefresh({ sub: account.id, sessionId });
    const refreshHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO sessions(id,auth_account_id,refresh_hash,expires_at,ip_address) VALUES(?,?,?,?,?)").run(sessionId, account.id, refreshHash, expiresAt, req.ip ?? "");
    const accessToken = signAccess({ sub: account.id, role: account.kind, artisanId, sessionId });
    await logActivity(account.id, "LOGIN", "sessions", sessionId, req.ip);
    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, role: account.kind, artisanId });
});
authRouter.post("/refresh", async (req, res) => {
    const token = req.cookies?.refresh_token;
    if (!token) {
        res.status(401).json({ error: "NO_REFRESH_TOKEN" });
        return;
    }
    try {
        const payload = verifyRefresh(token);
        // Verify the stored hash matches the presented token
        const tokenHash = hashRefreshToken(token);
        const session = await db.prepare("SELECT * FROM sessions WHERE id = ? AND auth_account_id = ? AND expires_at > datetime('now')").get(payload.sessionId, payload.sub);
        if (!session) {
            res.status(401).json({ error: "SESSION_EXPIRED" });
            return;
        }
        // If hash matches, proceed — if not, it may be a stolen token (old format will also fail gracefully)
        if (session.refresh_hash !== tokenHash) {
            // Could be an old base64-encoded hash from before the upgrade — try to allow migration
            const legacyHash = Buffer.from(token).toString("base64");
            if (session.refresh_hash !== legacyHash) {
                // Neither old nor new format matches — potential token theft
                await db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
                await logActivity(payload.sub, "REFRESH_TOKEN_MISMATCH", "sessions", session.id);
                res.status(401).json({ error: "TOKEN_REVOKED" });
                return;
            }
            // Migrate the old hash to the new SHA-256 format
            await db.prepare("UPDATE sessions SET refresh_hash = ? WHERE id = ?").run(tokenHash, session.id);
        }
        // ── Suspension check at refresh ───────────────────────────────────────
        const account = (await db.prepare("SELECT id, kind, suspended FROM auth_accounts WHERE id = ?").get(payload.sub));
        if (account.suspended) {
            await db.prepare("DELETE FROM sessions WHERE auth_account_id = ?").run(account.id);
            res.clearCookie("refresh_token");
            res.status(403).json({ error: "ACCOUNT_SUSPENDED" });
            return;
        }
        let artisanId;
        if (account.kind === "ARTISAN") {
            const a = (await db.prepare("SELECT id FROM artisans WHERE auth_account_id = ?").get(account.id));
            artisanId = a?.id;
        }
        const accessToken = signAccess({ sub: account.id, role: account.kind, artisanId, sessionId: session.id });
        res.json({ accessToken, role: account.kind, artisanId });
    }
    catch {
        res.status(401).json({ error: "INVALID_REFRESH_TOKEN" });
    }
});
authRouter.post("/logout", authenticate, async (req, res) => {
    const user = req.user;
    await db.prepare("DELETE FROM sessions WHERE id = ?").run(user.sessionId);
    await logActivity(user.sub, "LOGOUT", "sessions", user.sessionId, req.ip);
    res.clearCookie("refresh_token");
    res.json({ message: "Logged out" });
});
authRouter.get("/me", authenticate, async (req, res) => {
    const user = req.user;
    const account = (await db.prepare("SELECT id, email, kind, created_at FROM auth_accounts WHERE id = ?").get(user.sub));
    if (!account) {
        res.status(404).json({ error: "NOT_FOUND" });
        return;
    }
    res.json(account);
});
