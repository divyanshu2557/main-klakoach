import { authorize } from "../../security/auth-flow.js";
export class AdminService {
    async getPlatformAnalytics(request) {
        authorize(request, "analytics:read");
        return {
            revenue: "read from analytics snapshots, never from artisan routes",
            orders: "admin-only order aggregate",
            fraud: "risk engine signals",
            users: "growth and retention cohorts",
        };
    }
    async getOrders(request) {
        authorize(request, "orders:read");
        return {
            policy: "admin-only",
            includes: ["customer", "items", "payment", "shipping", "audit"],
        };
    }
    async moderateUser(request) {
        authorize(request, "users:write");
        return {
            actions: ["approve artisan", "suspend user", "change role", "record audit event"],
        };
    }
}
