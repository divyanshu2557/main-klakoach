import { verifyAccess } from "../security/tokens.js";
import { rolePermissions } from "../security/rbac.js";
export function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        res.status(401).json({ error: "UNAUTHORIZED" });
        return;
    }
    try {
        const payload = verifyAccess(header.slice(7));
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: "TOKEN_INVALID" });
    }
}
export function requirePermission(permission) {
    return (req, res, next) => {
        const user = req.user;
        const perms = rolePermissions[user?.role] ?? [];
        if (!perms.includes(permission)) {
            res.status(403).json({ error: "FORBIDDEN", required: permission });
            return;
        }
        next();
    };
}
