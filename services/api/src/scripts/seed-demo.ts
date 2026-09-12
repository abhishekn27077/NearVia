/**
 * NEARVIA Idempotent Demo Account Seed Script
 * Creates or updates canonical demo accounts in Supabase Auth & PostgreSQL:
 * - demo.worker@nearvia.test
 * - demo.provider@nearvia.test
 * - demo.agent@nearvia.test
 */

import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import { query } from "../db";
import { UserRole } from "@nearvia/types";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const DEMO_PASSWORD =
  process.env.DEMO_PASSWORD ||
  (process.env.NODE_ENV === "test" ? "TestEnvDemoPassword!2026" : "");

// Privileged client strictly requiring SUPABASE_SERVICE_ROLE_KEY (no fallback to anon key or placeholders)
export function getSeedAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "Privileged seed script strictly requires SUPABASE_SERVICE_ROLE_KEY to be set. Aborting to prevent unprivileged execution.",
    );
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface DemoUserDef {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  language: string;
  locationText: string;
  latitude: number;
  longitude: number;
}

const DEMO_USERS: DemoUserDef[] = [
  {
    email: "demo.worker@nearvia.test",
    fullName: "Suresh Patel (Demo Worker)",
    phone: "+919876543211",
    role: UserRole.WORKER,
    language: "English, Kannada, Hindi",
    locationText: "Domlur Layout, Bengaluru",
    latitude: 12.9610,
    longitude: 77.6372,
  },
  {
    email: "demo.provider@nearvia.test",
    fullName: "Ramesh Kumar (Demo Provider)",
    phone: "+919876543210",
    role: UserRole.PROVIDER,
    language: "English, Kannada",
    locationText: "100ft Road, Indiranagar, Bengaluru",
    latitude: 12.9784,
    longitude: 77.6408,
  },
  {
    email: "demo.agent@nearvia.test",
    fullName: "Sunita Rao (Demo Agent)",
    phone: "+919876543213",
    role: UserRole.AGENT,
    language: "English, Kannada, Tamil",
    locationText: "Indiranagar Metro Station Hub, Bengaluru",
    latitude: 12.9784,
    longitude: 77.6408,
  },
  {
    email: process.env.ADMIN_SEED_EMAIL || "admin@nearvia.test",
    fullName: "Platform Admin (Demo)",
    phone: "+919876543299",
    role: UserRole.ADMIN,
    language: "English, Kannada, Hindi",
    locationText: "NEARVIA HQ, MG Road, Bengaluru",
    latitude: 12.9716,
    longitude: 77.5946,
  },
];

export async function seedDemoAccounts(): Promise<void> {
  console.log("====================================================");
  console.log("🚀 NEARVIA IDEMPOTENT DEMO ACCOUNT SETUP");
  console.log("====================================================");

  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED_IN_PROD !== "true") {
    throw new Error("Demo seed cannot run in production environment unless ALLOW_DEMO_SEED_IN_PROD is set to true.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV === "test") {
    console.warn("⚠️ [Seed Script] Skipping seed in test environment without SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const supabaseAdmin = getSeedAdminClient();

  // 1. Fetch existing Supabase Auth users to check idempotency
  const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    console.error("❌ Failed to list Supabase Auth users:", listErr.message);
    throw listErr;
  }

  const existingAuthUsers = userList?.users || [];

  for (const def of DEMO_USERS) {
    let authId = "";
    const userPassword =
      def.role === UserRole.ADMIN
        ? process.env.ADMIN_SEED_PASSWORD || DEMO_PASSWORD
        : DEMO_PASSWORD;
    const existing = existingAuthUsers.find(
      (u) => u.email?.toLowerCase() === def.email.toLowerCase()
    );

    if (existing) {
      authId = existing.id;
      // Update password & metadata to ensure confirmed status
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          full_name: def.fullName,
          role: def.role,
        },
      });
      if (updateErr) {
        console.warn(`⚠️ Warning updating ${def.email}:`, updateErr.message);
      }
    } else {
      // Create new Supabase Auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: def.email,
        password: userPassword,
        email_confirm: true,
        user_metadata: {
          full_name: def.fullName,
          role: def.role,
        },
      });

      if (createErr || !created.user) {
        console.error(`❌ Failed to create Supabase Auth user ${def.email}:`, createErr?.message);
        throw createErr;
      }
      authId = created.user.id;
    }

    // 2. Upsert PostgreSQL users record cleanly
    const existingDbUser = await query<{ id: string }>(
      "SELECT id FROM users WHERE auth_id = $1 OR email = $2 OR phone = $3",
      [authId, def.email, def.phone]
    );

    let userId = "";
    if (existingDbUser.rows.length > 0 && existingDbUser.rows[0]) {
      userId = existingDbUser.rows[0].id;
      await query(
        `UPDATE users SET
          auth_id = $1,
          phone = $2,
          full_name = $3,
          email = $4,
          role = $5,
          language = $6,
          location_text = $7,
          latitude = $8,
          longitude = $9,
          mobile_verified = TRUE,
          mobile_verified_at = COALESCE(mobile_verified_at, NOW()),
          identity_verified = TRUE,
          identity_verified_at = COALESCE(identity_verified_at, NOW()),
          verification_provider = 'NEARVIA_DEMO_KYC',
          verification_reference = $10,
          profile_completed = TRUE,
          is_demo = TRUE,
          is_active = TRUE,
          updated_at = NOW()
        WHERE id = $11`,
        [
          authId,
          def.phone,
          def.fullName,
          def.email,
          def.role,
          def.language,
          def.locationText,
          def.latitude,
          def.longitude,
          `DEMO_REF_${authId}`,
          userId,
        ]
      );
    } else {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO users (
          auth_id, phone, full_name, email, role, language, location_text, 
          latitude, longitude, mobile_verified, mobile_verified_at, 
          identity_verified, identity_verified_at, verification_provider, 
          verification_reference, profile_completed, is_demo, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 
          $8, $9, TRUE, NOW(), 
          TRUE, NOW(), 'NEARVIA_DEMO_KYC', 
          $10, TRUE, TRUE, TRUE
        ) RETURNING id`,
        [
          authId,
          def.phone,
          def.fullName,
          def.email,
          def.role,
          def.language,
          def.locationText,
          def.latitude,
          def.longitude,
          `DEMO_REF_${authId}`,
        ]
      );
      userId = insertRes.rows[0]?.id || "";
    }

    if (!userId) {
      throw new Error(`Failed to upsert database user profile for ${def.email}`);
    }

    // 3. Role-specific profile upserts
    if (def.role === UserRole.WORKER) {
      const wpRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
          user_id, bio, experience_years, location, address_approximate, 
          service_radius_km, availability_status, is_available_now, 
          available_until, average_rating, completed_tasks_count
        ) VALUES (
          $1, 'Experienced retail helper and bakery assistant. Fluent in Kannada, English, Hindi.', 
          3.0, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, 
          5.0, 'AVAILABLE_NOW', TRUE, 
          NOW() + INTERVAL '8 hours', 4.95, 28
        )
        ON CONFLICT (user_id) DO UPDATE SET
          bio = EXCLUDED.bio,
          location = EXCLUDED.location,
          address_approximate = EXCLUDED.address_approximate,
          service_radius_km = 5.0,
          availability_status = 'AVAILABLE_NOW',
          is_available_now = TRUE,
          available_until = NOW() + INTERVAL '8 hours',
          updated_at = NOW()
        RETURNING id`,
        [userId, def.longitude, def.latitude, def.locationText]
      );

      const workerProfileId = wpRes.rows[0]?.id;

      // Seed worker skills
      if (workerProfileId) {
        await query(
          `INSERT INTO worker_skills (worker_id, skill_id, years_experience, is_verified)
           VALUES 
            ($1, 'b0000001-0000-0000-0000-000000000006', 2.5, TRUE),
            ($1, 'b0000001-0000-0000-0000-000000000004', 3.0, TRUE)
           ON CONFLICT (worker_id, skill_id) DO UPDATE SET is_verified = TRUE`,
          [workerProfileId]
        );
      }

      console.log(`\nDemo Worker:`);
      console.log(` ✓ Auth account exists (${def.email} | Auth ID: ${authId})`);
      console.log(` ✓ Profile exists (Database ID: ${userId})`);
      console.log(` ✓ Role = worker`);
      console.log(` ✓ Verification status = Email ✓ | Mobile ✓ | Identity ✓ (Demo KYC)`);
      console.log(` ✓ Service Radius: 5.0 KM | Location: ${def.locationText}`);
      console.log(` ✓ Ready`);
    } else if (def.role === UserRole.PROVIDER) {
      const ppRes = await query<{ id: string }>(
        `INSERT INTO provider_profiles (
          user_id, provider_type, business_name, description, 
          contact_phone, location, address_approximate, verified_business,
          average_rating, total_ratings_count, posted_jobs_count
        ) VALUES (
          $1, 'BUSINESS', 'Indiranagar Demo Bakery & Cafe', 
          'Fresh artisanal breads and daily bakery goods needing quick morning and evening assistants.', 
          $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, TRUE,
          4.90, 15, 6
        )
        ON CONFLICT (user_id) DO UPDATE SET
          business_name = EXCLUDED.business_name,
          description = EXCLUDED.description,
          contact_phone = EXCLUDED.contact_phone,
          location = EXCLUDED.location,
          address_approximate = EXCLUDED.address_approximate,
          verified_business = TRUE,
          updated_at = NOW()
        RETURNING id`,
        [userId, def.phone, def.longitude, def.latitude, def.locationText]
      );

      const providerProfileId = ppRes.rows[0]?.id;

      // Seed canonical Demo Job: "Bakery Helper & Counter Assistant"
      if (providerProfileId) {
        await query(
          `INSERT INTO work_opportunities (
            id, provider_id, category_id, title, description, work_type, urgency, 
            status, workers_needed, workers_assigned, location, address_approximate, 
            work_date, start_time, end_time, duration_hours, payment_amount, 
            payment_type, currency, responsibilities, instructions, 
            tools_provided, orientation_provided, is_demo
          ) VALUES (
            'f0000001-0000-0000-0000-000000000099',
            $1, 'a0000001-0000-0000-0000-000000000001',
            'Bakery Helper & Counter Assistant',
            'Help unpack bakery trays, display freshly baked goods, and assist with counter packaging during peak evening rush.',
            'TASK', 'NORMAL', 'PUBLISHED',
            2, 0, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4,
            CURRENT_DATE, CURRENT_DATE + TIME '16:00:00', CURRENT_DATE + TIME '18:00:00',
            2.00, 300.00, 'FIXED', 'INR',
            'Organize bread display shelves, box pastries for takeout orders, keep packaging counter clean.',
            'Report to main counter and ask for Bakery Manager Ramesh.',
            TRUE, TRUE, TRUE
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = 'PUBLISHED',
            payment_amount = 300.00,
            duration_hours = 2.00,
            work_date = CURRENT_DATE,
            start_time = CURRENT_DATE + TIME '16:00:00',
            end_time = CURRENT_DATE + TIME '18:00:00',
            is_demo = TRUE,
            updated_at = NOW()`,
          [providerProfileId, def.longitude, def.latitude, def.locationText]
        );
      }

      console.log(`\nDemo Provider:`);
      console.log(` ✓ Auth account exists (${def.email} | Auth ID: ${authId})`);
      console.log(` ✓ Profile exists (Business: Indiranagar Demo Bakery & Cafe)`);
      console.log(` ✓ Role = provider`);
      console.log(` ✓ Verification status = Email ✓ | Business Verified ✓`);
      console.log(` ✓ Canonical Demo Job: "Bakery Helper & Counter Assistant" (₹300, 2h) seeded`);
      console.log(` ✓ Ready`);
    } else if (def.role === UserRole.AGENT) {
      await query(
        `INSERT INTO agent_profiles (
          user_id, assigned_area, verified_workers_count, active_status,
          description, languages, location, address_approximate
        ) VALUES (
          $1, 'Indiranagar & Domlur Central', 18, TRUE,
          'Indiranagar Local Worker Assistance Hub helping offline workers access verified micro-shifts.',
          ARRAY['English', 'Kannada', 'Tamil'],
          ST_SetSRID(ST_MakePoint($2, $3), 4326), $4
        )
        ON CONFLICT (user_id) DO UPDATE SET
          assigned_area = EXCLUDED.assigned_area,
          verified_workers_count = EXCLUDED.verified_workers_count,
          active_status = TRUE,
          description = EXCLUDED.description,
          languages = EXCLUDED.languages,
          location = EXCLUDED.location,
          address_approximate = EXCLUDED.address_approximate,
          updated_at = NOW()`,
        [userId, def.longitude, def.latitude, def.locationText]
      );

      console.log(`\nDemo Agent:`);
      console.log(` ✓ Auth account exists (${def.email} | Auth ID: ${authId})`);
      console.log(` ✓ Profile exists (Hub: Indiranagar Local Worker Assistance Hub)`);
      console.log(` ✓ Role = agent`);
      console.log(` ✓ Verification status = Email ✓ | Certified Agent ✓`);
      console.log(` ✓ Ready`);
    }
  }

  console.log("\n====================================================");
  console.log("✅ DEMO SETUP COMPLETED SUCCESSFULLY (IDEMPOTENT)");
  console.log("====================================================");
}

// Run immediately when invoked as script
if (require.main === module || process.argv[1]?.includes("seed-demo")) {
  seedDemoAccounts()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed script failed:", err);
      process.exit(1);
    });
}
