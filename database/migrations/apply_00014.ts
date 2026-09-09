import fs from "fs";
import path from "path";
import { query } from "../../services/api/src/db";

async function applyMigration() {
  const sqlPath = path.join(__dirname, "00014_v1_email_verification_and_optional_phone.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Applying migration 00014...");
  await query(sql);
  console.log("Migration 00014 applied successfully!");
  process.exit(0);
}

applyMigration().catch((err) => {
  console.error("Migration 00014 failed:", err);
  process.exit(1);
});
