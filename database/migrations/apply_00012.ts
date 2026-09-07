import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../services/api/.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import fs from "fs";
import { query } from "../../services/api/src/db";

async function applyMigration() {
  console.log("Applying Migration 00012: Phase 8 Intelligence Layer...");
  const sqlPath = path.resolve(__dirname, "00012_phase8_intelligence_layer.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  await query(sql);
  console.log("✅ Migration 00012 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("❌ Migration 00012 error:", err);
  process.exit(1);
});
