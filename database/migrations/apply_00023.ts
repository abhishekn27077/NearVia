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

  const sqlPath = path.join(__dirname, "00023_payments_cash_hardening.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Applying migration 00023 (Payments, Cash & Settlement Hardening)...");
  
  await pool.query(sql);
  console.log("Migration 00023 applied successfully!");
  await pool.end();
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00023 failed:", err);
  process.exit(1);
});
