import { assertPermission, type Permission, type Role } from "./rbac.js";

export type AuthenticatedRequest = {
  user: {
    id: string;
    role: Role;
    artisanId?: string;
    sessionId: string;
  };
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
};

export function authorize(request: AuthenticatedRequest, permission: Permission) {
  assertPermission(request.user.role, permission);
  return request.user;
}

export const authenticationFlow = [
  "Validate credentials with Zod DTOs",
  "Verify password using Argon2id",
  "Create short-lived JWT access token",
  "Create rotating refresh token stored as a hash in Session",
  "Set refresh token in secure httpOnly sameSite cookie",
  "Attach user role and session id to request context",
  "Run permission guard before controller and repository access",
  "Write append-only ActivityLog entry for sensitive operations",
] as const;