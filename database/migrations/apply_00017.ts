import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../services/api/.env") });
import { query } from "../../services/api/src/db";

async function applyMigration() {
  const sqlPath = path.join(__dirname, "00017_attendance_checkout_fields.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Applying migration 00017...");
  await query(sql);
  console.log("Migration 00017 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00017 failed:", err);
  process.exit(1);
});
