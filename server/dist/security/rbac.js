export const rolePermissions = {
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
export function assertPermission(role, permission) {
    if (!rolePermissions[role]?.includes(permission)) {
        throw new Error(`RBAC_DENIED:${role}:${permission}`);
    }
}
export function assertArtisanOwnsResource(params) {
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
];
