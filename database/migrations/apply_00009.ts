import fs from "fs";
import path from "path";
import { query } from "../../services/api/src/db";

async function applyMigration() {
  console.log("Applying Migration 00009...");
  const sqlPath = path.resolve(__dirname, "00009_phase5_realtime_marketplace.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  await query(sql);
  console.log("Migration 00009 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00009 error:", err);
  process.exit(1);
});
