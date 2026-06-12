export type Role = "CUSTOMER" | "ARTISAN" | "ADMIN" | string;

export type Permission =
  | "products:read"
  | "wishlist:write"
  | "cart:checkout"
  | "artisan:profile"
  | "inventory:write"
  | "media:write"
  | "orders:read"
  | "orders:write"
  | "analytics:read"
  | "users:write"
  | "security:read"
  | "admin:settings";

export const rolePermissions: Record<Role, Permission[]> = {
  CUSTOMER: ["products:read", "wishlist:write", "cart:checkout"],
  ARTISAN: ["products:read", "artisan:profile", "inventory:write", "media:write"],
  ADMIN: [
    "products:read",
    "wishlist:write",
    "cart:checkout",
    "artisan:profile",
    "inventory:write",
    "media:write",
    "orders:read",
    "orders:write",
    "analytics:read",
    "users:write",
    "security:read",
    "admin:settings",
  ],
};

export function assertPermission(role: Role, permission: Permission) {
  if (!rolePermissions[role]?.includes(permission)) {
    throw new Error(`RBAC_DENIED:${role}:${permission}`);
  }
}

export function assertArtisanOwnsResource(params: { role: Role; actorArtisanId?: string; resourceArtisanId: string }) {
  if (params.role === "ADMIN") {
    return;
  }

  if (params.role !== "ARTISAN" || params.actorArtisanId !== params.resourceArtisanId) {
    throw new Error("OWNERSHIP_DENIED");
  }
}

export const forbiddenForArtisans = [
  "customer order details",
  "buyer information",
  "revenue analytics",
  "platform statistics",
  "other artisan data",
  "global sales data",
] as const;