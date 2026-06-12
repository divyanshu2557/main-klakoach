import type { Request, Response, NextFunction } from "express";
import { verifyAccess, type JwtPayload } from "../security/tokens.js";
import { rolePermissions, type Permission } from "../security/rbac.js";

export type AuthRequest = Request & { user: JwtPayload };

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const payload = verifyAccess(header.slice(7));
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "TOKEN_INVALID" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    const perms = rolePermissions[user?.role as keyof typeof rolePermissions] ?? [];
    if (!perms.includes(permission)) {
      res.status(403).json({ error: "FORBIDDEN", required: permission });
      return;
    }
    next();
  };
}
