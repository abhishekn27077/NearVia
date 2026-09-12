/**
 * NEARVIA Unified Database Migration Runner
 * 
 * Sequentially applies all numbered SQL migrations from database/migrations/
 * Tracks applied migrations in the `_schema_migrations` table.
 * Baseline-aware and idempotent: safe for both fresh databases and existing instances.
 * 
 * Usage:
 *   npm run db:migrate
 *   npx tsx src/scripts/migrate.ts
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";

// Support running from root, services/api, or deployment container
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const KNOWN_DUPLICATE_CODES = new Set([
  "42710", // duplicate_object (e.g. type already exists)
  "42P07", // duplicate_table (relation already exists)
  "42701", // duplicate_column (column already exists)
  "42P16", // invalid_table_definition / duplicate index
]);

async function detectExistingBaseline(client: PoolClient): Promise<string[]> {
  const baselined: string[] = [];

  // Check if users table exists
  const tableCheck = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    );
  `);

  if (tableCheck.rows[0]?.exists) {
    // Database already has schema applied prior to migration tracker
    baselined.push("00001_init_postgis.sql");
    baselined.push("00002_master_schema.sql");

    // Check individual tables/features for incremental migrations
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
    `);
    const tableNames = new Set(tablesRes.rows.map((r) => r.table_name));

    if (tableNames.has("agent_worker_relationships")) baselined.push("00003_agent_worker_relationships.sql");
    if (tableNames.has("attendance_records")) baselined.push("00003_phase10_execution_fields.sql");
    if (tableNames.has("disputes") || tableNames.has("reports")) baselined.push("00005_reports_disputes_safety.sql");
    if (tableNames.has("platform_events")) baselined.push("00006_platform_events.sql");
    if (tableNames.has("conversations")) baselined.push("00007_conversations_and_messages.sql");
    if (tableNames.has("otp_challenges")) baselined.push("00008_otp_verification_challenges.sql");

    // Check indexes
    const indexRes = await client.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
    `);
    const indexNames = new Set(indexRes.rows.map((r) => r.indexname));

    if (indexNames.has("idx_users_email_lower")) baselined.push("00013_users_case_insensitive_email_unique.sql");
    if (indexNames.has("idx_worker_availability_freshness")) baselined.push("00015_worker_availability_freshness.sql");
    if (indexNames.has("idx_unique_assignment_active_application")) baselined.push("00021_marketplace_lifecycle_integrity.sql");
    if (indexNames.has("idx_worker_profiles_active_matching")) baselined.push("00026_smart_matching_performance.sql");
    if (indexNames.has("idx_worker_profiles_radar_active")) baselined.push("00027_workforce_radar_performance.sql");
    if (indexNames.has("idx_payment_records_admin_analytics")) baselined.push("00028_admin_analytics_indexes.sql");
  }

  return baselined;
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  console.log("====================================================");
  console.log("🐘 NEARVIA SEQUENTIAL DATABASE MIGRATION RUNNER");
  console.log("====================================================");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables.");
  }

  const pool = new Pool({
    connectionString,
    ssl:
      connectionString.includes("supabase.co") || process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const applied: string[] = [];
  const skipped: string[] = [];

  const client = await pool.connect();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already recorded migrations
    let existingRes = await client.query<{ name: string }>(
      `SELECT name FROM _schema_migrations ORDER BY id ASC`
    );

    // If tracker is empty, inspect existing schema to baseline already-present migrations
    if (existingRes.rows.length === 0) {
      const baselined = await detectExistingBaseline(client);
      if (baselined.length > 0) {
        console.log(`ℹ️  Existing schema detected without tracking history. Baselining ${baselined.length} migration(s)...`);
        for (const name of baselined) {
          await client.query(
            `INSERT INTO _schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
            [name]
          );
        }
        existingRes = await client.query<{ name: string }>(
          `SELECT name FROM _schema_migrations ORDER BY id ASC`
        );
      }
    }

    const existingSet = new Set(existingRes.rows.map((r) => r.name));

    // 3. Scan database/migrations directory for .sql files
    const migrationsDir = path.resolve(__dirname, "../../../../database/migrations");
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    console.log(`Found ${files.length} migration files in ${migrationsDir}.\n`);

    for (const file of files) {
      if (existingSet.has(file)) {
        skipped.push(file);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`  -> Applying [${file}]...`);
      const start = Date.now();

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO _schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [file]
        );
        await client.query("COMMIT");
        const elapsed = Date.now() - start;
        console.log(`     ✓ Applied in ${elapsed}ms`);
        applied.push(file);
      } catch (err: any) {
        await client.query("ROLLBACK");

        // Handle case where objects were already created manually in the past
        if (err.code && KNOWN_DUPLICATE_CODES.has(err.code)) {
          console.log(`     ℹ️  Schema elements already present (${err.message}). Baselining.`);
          await client.query(
            `INSERT INTO _schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
            [file]
          );
          applied.push(file);
          continue;
        }

        console.error(`\n❌ Migration failed on [${file}]:`, err.message || err);
        throw err;
      }
    }

    console.log("\n====================================================");
    if (applied.length === 0) {
      console.log(`✅ All ${files.length} migrations are already up-to-date.`);
    } else {
      console.log(`✅ Successfully applied/baselined ${applied.length} migration(s). (${skipped.length} already up-to-date).`);
    }
    console.log("====================================================\n");

    return { applied, skipped };
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module || process.argv[1]?.includes("migrate")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration execution failed:", err);
      process.exit(1);
    });
}
