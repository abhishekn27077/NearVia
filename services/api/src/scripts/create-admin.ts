/**
 * NEARVIA Secure First-Admin Provisioning Utility
 * 
 * Securely creates or elevates a platform operator to the ADMIN role.
 * Strictly uses SUPABASE_SERVICE_ROLE_KEY and direct PostgreSQL connection.
 * 
 * Usage:
 *   npx tsx src/scripts/create-admin.ts --email admin@nearvia.in [--name "Super Admin"] [--password "<STRONG_PASSWORD>"]
 */

import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { query } from "../db";
import { UserRole } from "@nearvia/types";
import { logAuditEvent } from "../utils/audit";

function parseArgs(): { email?: string; name?: string; password?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; name?: string; password?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    const next = args[i + 1];
    if (current === "--email" && next) {
      result.email = next.trim().toLowerCase();
      i++;
    } else if (current === "--name" && next) {
      result.name = next.trim();
      i++;
    } else if (current === "--password" && next) {
      result.password = next;
      i++;
    }
  }

  return result;
}

export async function createOrElevateAdmin(): Promise<void> {
  console.log("====================================================");
  console.log("🛡️  NEARVIA SECURE ADMIN PROVISIONING");
  console.log("====================================================");

  const { email, name = "Platform Administrator", password } = parseArgs();

  if (!email || !email.includes("@")) {
    console.error("❌ ERROR: Valid --email argument is required.");
    console.error("   Example: npx tsx src/scripts/create-admin.ts --email ops@nearvia.in");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.");
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Generate secure password if not explicitly supplied
  const adminPassword = password || crypto.randomBytes(12).toString("base64url") + "!N9";

  console.log(`\n[1/3] Provisioning Supabase Auth identity for: ${email}...`);
  let authUserId: string;

  // Check if user already exists in Supabase Auth
  const { data: userList, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Supabase users: ${listError.message}`);
  }

  const existingAuthUser = userList.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;
    console.log(`  ✓ Found existing Supabase Auth account (${authUserId}). Updating metadata & role...`);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
      user_metadata: {
        ...existingAuthUser.user_metadata,
        role: UserRole.ADMIN,
        full_name: name,
      },
      ...(password ? { password } : {}),
    });
    if (updateError) {
      throw new Error(`Failed to update Auth user: ${updateError.message}`);
    }
  } else {
    console.log("  ✓ Creating new confirmed Supabase Auth identity...");
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        role: UserRole.ADMIN,
        full_name: name,
      },
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create Auth user: ${createError?.message || "Unknown"}`);
    }
    authUserId = newUser.user.id;
  }

  console.log("\n[2/3] Synchronizing PostgreSQL application database...");
  const dbUserRes = await query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE LOWER(email) = LOWER($1) OR auth_id = $2`,
    [email, authUserId]
  );

  let internalUserId: string;

  const firstRow = dbUserRes.rows[0];
  if (firstRow) {
    internalUserId = firstRow.id;
    console.log(`  ✓ Elevating existing database user (${internalUserId}) to role: ADMIN...`);
    await query(
      `UPDATE users
       SET role = 'ADMIN',
           is_verified = TRUE,
           is_active = TRUE,
           full_name = $1,
           auth_id = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [name, authUserId, internalUserId]
    );
  } else {
    console.log("  ✓ Inserting new ADMIN record in PostgreSQL users table...");
    const insertRes = await query<{ id: string }>(
      `INSERT INTO users (
        auth_id, email, full_name, role, is_verified, is_active, phone
       ) VALUES ($1, $2, $3, 'ADMIN', TRUE, TRUE, '+910000000000')
       RETURNING id`,
      [authUserId, email, name]
    );
    const newRow = insertRes.rows[0];
    if (!newRow) throw new Error("Failed to insert user into PostgreSQL.");
    internalUserId = newRow.id;
  }

  console.log("\n[3/3] Emitting security audit event...");
  await logAuditEvent({
    actorId: internalUserId,
    action: "USER_ROLE_ELEVATED",
    targetEntity: "users",
    targetId: internalUserId,
    newValues: {
      email,
      role: "ADMIN",
      provisionedBy: "CLI_ADMIN_PROVISIONER",
      timestamp: new Date().toISOString(),
    },
  });

  console.log("====================================================");
  console.log("✅ ADMIN ACCOUNT SUCCESSFULLY PROVISIONED");
  console.log("====================================================");
  console.log(`  Email:       ${email}`);
  console.log(`  Name:        ${name}`);
  console.log(`  Role:        ADMIN`);
  console.log(`  Internal ID: ${internalUserId}`);
  if (!password && !existingAuthUser) {
    console.log(`  Temporary Password: ${adminPassword}`);
    console.log("  ⚠️  SAVE THIS PASSWORD NOW. It will not be shown again.");
  }
  console.log("\nAccess the dedicated Admin Console at:");
  console.log("  Production: https://admin.nearvia.in/login");
  console.log("  Local Dev:  http://localhost:5174/login");
  console.log("====================================================\n");
}

if (require.main === module || process.argv[1]?.includes("create-admin")) {
  createOrElevateAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ Provisioning failed:", err.message || err);
      process.exit(1);
    });
}
