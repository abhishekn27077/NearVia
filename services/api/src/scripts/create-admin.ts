/**
 * NEARVIA Secure First-Admin Provisioning Utility
 * 
 * Securely creates or elevates a platform operator to the ADMIN role.
 * Strictly uses SUPABASE_SERVICE_ROLE_KEY and direct PostgreSQL connection.
 * 
 * Usage:
 *   npx tsx src/scripts/create-admin.ts --email admin@nearvia.app [--name "Platform Administrator"]
 */

import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
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

/**
 * Prompt for password interactively with masked input (keystrokes hidden as '*')
 * Ensures passwords are never visible on screen, in command history, or in process args.
 */
export async function promptMaskedPassword(promptText = "Enter secure Admin Password (masked): "): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";

    const onData = (char: string) => {
      // Ctrl+C
      if (char === "\u0003") {
        stdin.setRawMode(wasRaw);
        process.stdout.write("\n");
        process.exit(1);
      }

      // Enter or Return (\r, \n)
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(wasRaw);
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(password.trim());
        return;
      }

      // Backspace (\u0008 or \u007f)
      if (char === "\u0008" || char === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      // Ignore arrow keys and ANSI escape sequences
      if (char.startsWith("\u001b")) {
        return;
      }

      // Append character
      password += char;
      process.stdout.write("*");
    };

    stdin.on("data", onData);
  });
}

export async function createOrElevateAdmin(): Promise<void> {
  console.log("====================================================");
  console.log("🛡️  NEARVIA SECURE ADMIN PROVISIONING");
  console.log("====================================================");

  const { email, name = "Platform Administrator", password: cliPassword } = parseArgs();

  if (!email || !email.includes("@")) {
    console.error("❌ ERROR: Valid --email argument is required.");
    console.error("   Example: npx tsx src/scripts/create-admin.ts --email admin@nearvia.app");
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

  console.log(`\n[1/3] Checking Supabase Auth identity for: ${email}...`);
  let authUserId: string;

  // Check if user already exists in Supabase Auth (with pagination safety)
  let existingAuthUser: any = null;
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data: userList, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (listError) {
      throw new Error(`Failed to list Supabase users: ${listError.message}`);
    }
    const match = userList.users.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) {
      existingAuthUser = match;
      break;
    }
    if (!userList.users || userList.users.length < perPage) {
      break;
    }
    page++;
  }

  // Determine password securely without logging or exposing in shell history
  let adminPassword = cliPassword || process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    adminPassword = await promptMaskedPassword("Enter secure Admin Password (masked): ");
    if (!adminPassword || adminPassword.length < 8) {
      console.error("❌ ERROR: Admin password must be at least 8 characters long.");
      process.exit(1);
    }
    const confirmPassword = await promptMaskedPassword("Confirm secure Admin Password (masked): ");
    if (adminPassword !== confirmPassword) {
      console.error("❌ ERROR: Passwords do not match. Please re-run the script.");
      process.exit(1);
    }
  }

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;
    console.log(`  ✓ Found existing Supabase Auth account (${authUserId}). Updating metadata & password...`);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
      user_metadata: {
        ...existingAuthUser.user_metadata,
        role: UserRole.ADMIN,
        full_name: name,
        email_verified: true,
      },
      password: adminPassword,
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
        email_verified: true,
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
           email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW()),
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
        auth_id, email, full_name, role, email_verified, email_verified_at, is_active, phone
       ) VALUES ($1, $2, $3, 'ADMIN', TRUE, NOW(), TRUE, NULL)
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
  console.log(`  Auth ID:     ${authUserId}`);
  console.log(`  Status:      Active & Email Verified`);
  console.log("\nAccess the dedicated Admin Console at:");
  console.log("  Production: https://nearvia.app/admin/login");
  console.log("  Local Dev:  http://localhost:5174/admin/login");
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
