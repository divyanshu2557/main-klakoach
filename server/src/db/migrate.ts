import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../../../klakoach.db");

const sqliteDb = new Database(DB_PATH);
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to migrate data.");
}
const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("Starting migration from SQLite to Neon Postgres...");

  const tables = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as unknown as {name: string}[];

  for (const { name: tableName } of tables) {
    console.log(`Migrating table: ${tableName}`);
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all() as unknown as any[];
    if (rows.length === 0) {
      console.log(`  - 0 rows, skipping.`);
      continue;
    }

    // Get columns
    const columns = Object.keys(rows[0]);
    
    for (const row of rows) {
      try {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await sql(query as any, values as any);
      } catch (e: any) {
        console.error(`  - Failed to insert row into ${tableName}: ${e.message}`);
      }
    }
    console.log(`  - Migrated ${rows.length} rows.`);
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);
