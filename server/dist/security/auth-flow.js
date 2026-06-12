import { assertPermission } from "./rbac.js";
export function authorize(request, permission) {
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
];
