/**
 * NEARVIA Safe Demo Data Reset Script
 * Resets ONLY demo records (is_demo = true or demo test emails).
 * NEVER deletes real production users or jobs.
 */

import dotenv from "dotenv";
dotenv.config();

import { query } from "../db";
import { seedDemoAccounts } from "./seed-demo";

export async function resetDemoData(): Promise<void> {
  console.log("====================================================");
  console.log("🧹 NEARVIA SAFE DEMO DATA RESET");
  console.log("====================================================");

  // 1. Remove demo job applications & assignments first to preserve foreign keys
  await query(`
    DELETE FROM applications 
    WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE is_demo = TRUE)
       OR worker_id IN (SELECT id FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE is_demo = TRUE));
  `);

  await query(`
    DELETE FROM assignments
    WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE is_demo = TRUE)
       OR worker_id IN (SELECT id FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE is_demo = TRUE));
  `);

  // 2. Remove demo work opportunities
  const deletedJobs = await query(`
    DELETE FROM work_opportunities WHERE is_demo = TRUE RETURNING id, title;
  `);
  console.log(`✓ Removed ${deletedJobs.rowCount} temporary demo work opportunities.`);

  // 3. Re-run idempotent seed to restore clean canonical demo accounts & jobs
  console.log("✓ Restoring clean canonical demo accounts & opportunities...");
  await seedDemoAccounts();

  console.log("====================================================");
  console.log("✅ DEMO DATA RESET COMPLETE");
  console.log("====================================================");
}

if (require.main === module || process.argv[1]?.includes("reset-demo")) {
  resetDemoData()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Reset script failed:", err);
      process.exit(1);
    });
}
