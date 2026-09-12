import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: path.join(__dirname, "../../services/api/.env") });

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in services/api/.env");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false,
  });

  const sqlPath = path.join(__dirname, "00026_smart_matching_performance.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Applying migration 00026 (Smart Matching Performance Indexes)...");
  
  await pool.query(sql);
  console.log("Migration 00026 applied successfully!");
  await pool.end();
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00026 failed:", err);
  process.exit(1);
});
