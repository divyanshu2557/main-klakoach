import jwt from "jsonwebtoken";
import * as argon2 from "argon2";
import * as crypto from "crypto";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
// ── Secret Management ─────────────────────────────────────────────────────────
// Production uses asymmetric ES512 keys. Development may use a local HMAC secret
// so contributors can run the app without generating PEM keys.
const ACCESS_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
const ACCESS_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const USE_ASYMMETRIC_JWT = Boolean(ACCESS_PRIVATE_KEY && ACCESS_PUBLIC_KEY);
const DEV_JWT_SECRET = process.env.JWT_DEV_SECRET ?? "klakoach_dev_secret_change_me_32chars";
if (IS_PRODUCTION && !USE_ASYMMETRIC_JWT) {
    console.error("\n🔴 FATAL: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production.\n");
    process.exit(1);
}
if (!IS_PRODUCTION && !USE_ASYMMETRIC_JWT) {
    console.warn("⚠️  JWT_PRIVATE_KEY/JWT_PUBLIC_KEY not set — using development HS256 secret.");
}
// ── Token Signing & Verification ──────────────────────────────────────────────
function jwtSignKey() {
    return USE_ASYMMETRIC_JWT ? ACCESS_PRIVATE_KEY : DEV_JWT_SECRET;
}
function jwtVerifyKey() {
    return USE_ASYMMETRIC_JWT ? ACCESS_PUBLIC_KEY : DEV_JWT_SECRET;
}
export function signAccess(payload) {
    return jwt.sign(payload, jwtSignKey(), { algorithm: USE_ASYMMETRIC_JWT ? "RS512" : "HS256", expiresIn: "15m" });
}
export function signRefresh(payload) {
    return jwt.sign(payload, jwtSignKey(), { algorithm: USE_ASYMMETRIC_JWT ? "RS512" : "HS256", expiresIn: "7d" });
}
export function verifyAccess(token) {
    return jwt.verify(token, jwtVerifyKey(), { algorithms: [USE_ASYMMETRIC_JWT ? "RS512" : "HS256"] });
}
export function verifyRefresh(token) {
    return jwt.verify(token, jwtVerifyKey(), { algorithms: [USE_ASYMMETRIC_JWT ? "RS512" : "HS256"] });
}
// ── Refresh Token Hashing ─────────────────────────────────────────────────────
// We store a SHA-256 hash of the refresh token, never the token itself.
export function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
// ── Password Hashing ─────────────────────────────────────────────────────────
export async function hashPassword(plain) {
    return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3 });
}
export async function verifyPassword(hash, plain) {
    return argon2.verify(hash, plain);
}
