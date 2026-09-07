import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../services/api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import fs from "fs";
import { query } from "../../services/api/src/db";

async function applyMigration() {
  console.log("Applying Migration 00010: Phase 6 Work Execution, Job PIN, Evidence & Attendance...");
  const sqlPath = path.resolve(__dirname, "00010_phase6_work_execution.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  await query(sql);
  console.log("✅ Migration 00010 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("❌ Migration 00010 error:", err);
  process.exit(1);
});
