import Database from "better-sqlite3";
const db = new Database("klakoach.db");
const order = db.prepare("SELECT id FROM orders LIMIT 1").get();
console.log("ORDER ID:", order?.id);
