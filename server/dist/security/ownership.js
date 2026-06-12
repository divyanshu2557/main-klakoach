import { db } from "../db/index.js";
export async function verifyOwnership(userId, role, table, resourceId, column = "auth_account_id") {
    if (role === "ADMIN")
        return true;
    // Safety check: prevent SQL injection in table/column names
    const allowedTables = ["products", "artisans", "customers", "orders", "addresses"];
    const allowedColumns = ["auth_account_id", "customer_id", "artisan_id"];
    if (!allowedTables.includes(table) || !allowedColumns.includes(column)) {
        throw new Error("INVALID_OWNERSHIP_CHECK_PARAMS");
    }
    const row = await db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND ${column} = ?`).get(resourceId, userId);
    return !!row;
}
export async function getProfileId(userId, role) {
    const table = role === "CUSTOMER" ? "customers" : role === "ARTISAN" ? "artisans" : null;
    if (!table)
        return undefined;
    const row = await db.prepare(`SELECT id FROM ${table} WHERE auth_account_id = ?`).get(userId);
    return row?.id;
}
