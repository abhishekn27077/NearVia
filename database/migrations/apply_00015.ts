import fs from "fs";
import path from "path";
import { query } from "../../services/api/src/db";

async function applyMigration() {
  const sqlPath = path.join(__dirname, "00015_worker_availability_freshness.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Applying migration 00015...");
  await query(sql);
  console.log("Migration 00015 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00015 failed:", err);
  process.exit(1);
});
