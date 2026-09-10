/**
 * Auth Module Domain Service
 * Handles application user synchronization, registration rules, verification states, and session queries.
 */

import crypto from "crypto";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { RegisterRequestInput } from "@nearvia/validation";
import { ErrorCode } from "@nearvia/config";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import {
  getSupabaseServerClient,
  getSupabaseAdminClient,
} from "../../services/supabase.service";

export class AuthService {
  /**
   * Provision user via Supabase Auth Admin and register application profile in Supabase PostgreSQL
   * Bypasses the client-side public SMTP rate limits.
   */
  public async signUpWithEmail(input: {
    email: string;
    password?: string;
    fullName: string;
    phone?: string;
    role: UserRole;
  }): Promise<AuthUserContext> {
    const roleValue = input.role as UserRole;
    if (roleValue === UserRole.ADMIN) {
      throw new AppError(
        "Public registration as ADMIN is strictly prohibited.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }
    if (![UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(roleValue)) {
      throw new AppError(
        "Role must be WORKER, PROVIDER, or AGENT.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (!input.password || input.password.length < 6 || input.password.length > 100) {
      throw new AppError(
        "Password must be between 6 and 100 characters long.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const trimmedEmail = input.email.trim().toLowerCase();

    // Check if user with this email already exists in NEARVIA PostgreSQL users table
    const existingDbUser = await query<any>(
      "SELECT id, auth_id, email, phone FROM users WHERE LOWER(email) = $1",
      [trimmedEmail],
    );
    if (existingDbUser.rows.length > 0) {
      throw new AppError(
        "An account with this email address already exists. Please log in or reset your password.",
        409,
        ErrorCode.CONFLICT,
      );
    }

    // Check phone collision if supplied
    if (input.phone) {
      const existingPhone = await query<any>(
        "SELECT id FROM users WHERE phone = $1",
        [input.phone.trim()],
      );
      if (existingPhone.rows.length > 0) {
        throw new AppError(
          "An account with this phone number already exists.",
          409,
          ErrorCode.CONFLICT,
        );
      }
    }

    const supabase = getSupabaseAdminClient() || getSupabaseServerClient();
    let authId: string;

    if (supabase) {
      try {
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existingAuth = userList?.users?.find(
          (u) => u.email?.toLowerCase() === trimmedEmail,
        );

        if (existingAuth) {
          // SECURITY HARDENING: Never silently update password or hijack accounts on registration!
          throw new AppError(
            "An account with this email address already exists. Please log in or reset your password.",
            409,
            ErrorCode.CONFLICT,
          );
        }

        const isTestAccount = trimmedEmail.endsWith("@nearvia.test") || process.env.NODE_ENV === "test";

        const { data: newAuth, error: createError } =
          await supabase.auth.admin.createUser({
            email: trimmedEmail,
            password: input.password,
            email_confirm: isTestAccount,
            user_metadata: {
              full_name: input.fullName,
              role: roleValue,
            },
          });

        if (createError || !newAuth.user) {
          throw new AppError(
            createError?.message || "Failed to provision authentication account.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        authId = newAuth.user.id;
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        console.error("[AuthService] Supabase registration error:", err.message);
        throw new AppError(
          "Failed to connect to authentication provider.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }
    } else {
      authId = `user_${Date.now()}`;
    }

    const phone = input.phone?.trim() || undefined;

    return this.registerUser({
      authId,
      phone,
      fullName: input.fullName,
      email: trimmedEmail,
      role: roleValue as UserRole.WORKER | UserRole.PROVIDER | UserRole.AGENT,
    });
  }

  /**
   * Confirms user email in Supabase Auth (Strictly disabled in production, demo accounts only in dev)
   */
  public async confirmUserEmail(email: string, authenticatedEmail?: string): Promise<boolean> {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Public email confirmation is disabled in production. Please use the verification link sent to your email.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // If caller provided an authenticated email, prevent confirming someone else's email
    if (authenticatedEmail && authenticatedEmail.trim().toLowerCase() !== normalizedEmail) {
      throw new AppError(
        "Cannot confirm email for another user account.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    if (!normalizedEmail.endsWith("@nearvia.test")) {
      throw new AppError(
        "Automated email confirmation is only permitted for test accounts (*@nearvia.test) in development.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const supabase = getSupabaseAdminClient() || getSupabaseServerClient();
    if (!supabase) return true;

    try {
      const { data: userList } = await supabase.auth.admin.listUsers();
      const user = userList?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail,
      );

      if (user) {
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      }
      return true;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      return false;
    }
  }

  /**
   * Synchronize & Register a new NEARVIA Application User
   * Strict Rule: Public registration as ADMIN is strictly prohibited.
   */
  public async registerUser(
    data: RegisterRequestInput,
  ): Promise<AuthUserContext> {
    const roleValue = data.role as UserRole;
    if (roleValue === UserRole.ADMIN) {
      throw new AppError(
        "Public registration as ADMIN is strictly prohibited. Admin accounts require server-side provisioning.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }
    if (![UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(roleValue)) {
      throw new AppError(
        "Role must be WORKER, PROVIDER, or AGENT.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check for existing user by auth_id, phone (if provided), or email (if provided)
    const existing = await query<{
      id: string;
      auth_id: string;
      phone: string | null;
      email: string | null;
    }>(
      `SELECT id, auth_id, phone, email FROM users 
       WHERE auth_id = $1 
          OR ($2::varchar IS NOT NULL AND phone = $2) 
          OR ($3::varchar IS NOT NULL AND LOWER(email) = LOWER($3))`,
      [data.authId, data.phone || null, data.email || null],
    );

    if (existing.rows.length > 0) {
      // If already registered with this exact auth_id, return existing profile
      const matchingAuth = existing.rows.find((r) => r.auth_id === data.authId);
      if (matchingAuth) {
        const existingUser = await this.getUserByAuthId(data.authId);
        if (existingUser) {
          if (!existingUser.isActive) {
            throw new AppError(
              "Your NEARVIA account has been suspended or deactivated. Contact support.",
              403,
              ErrorCode.FORBIDDEN,
            );
          }
          return existingUser;
        }
      }

      throw new AppError(
        "A NEARVIA user account with this authentication identity, phone number, or email already exists.",
        409,
        ErrorCode.CONFLICT,
      );
    }

    const isTestAccount = Boolean(
      (data.email && data.email.endsWith("@nearvia.test")) || process.env.NODE_ENV === "test"
    );

    // Insert user into PostgreSQL users table (safely handling concurrent duplicate registration races)
    let result;
    try {
      result = await query<any>(
        `INSERT INTO users (
          auth_id, phone, full_name, email, role, avatar_url, 
          email_verified, email_verified_at,
          mobile_verified, identity_verified, profile_completed, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, FALSE, FALSE, TRUE)
        RETURNING *`,
        [
          data.authId,
          data.phone || null,
          data.fullName,
          data.email ?? null,
          data.role,
          data.avatarUrl ?? null,
          isTestAccount,
          isTestAccount ? new Date() : null,
        ],
      );
    } catch (err: any) {
      if (err?.code === "23505") {
        throw new AppError(
          "A user account with this email, phone, or authentication identity already exists.",
          409,
          ErrorCode.CONFLICT,
        );
      }
      throw err;
    }

    const userRow = result.rows[0];
    if (!userRow) {
      throw new AppError(
        "Failed to create user account.",
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    // Initialize domain profile record with default central location
    if (roleValue === UserRole.WORKER) {
      await query(
        `INSERT INTO worker_profiles (user_id, service_radius_km, availability_status, is_available_now, location, address_approximate) 
         VALUES ($1, 5.0, 'OFFLINE', FALSE, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id],
      );
    } else if (roleValue === UserRole.PROVIDER) {
      await query(
        `INSERT INTO provider_profiles (user_id, provider_type, business_name, location, address_approximate) 
         VALUES ($1, 'INDIVIDUAL', $2, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id, userRow.full_name],
      );
    } else if (roleValue === UserRole.AGENT) {
      await query(
        `INSERT INTO agent_profiles (user_id, assigned_area, active_status, location, address_approximate) 
         VALUES ($1, 'Central Service Area', TRUE, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id],
      );
    }

    return this.mapUserRow(userRow);
  }

  /**
   * Look up user by Supabase Auth UUID
   */
  public async getUserByAuthId(
    authId: string,
  ): Promise<AuthUserContext | null> {
    const result = await query<any>(
      "SELECT * FROM users WHERE auth_id = $1",
      [authId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Look up user by internal database UUID
   */
  public async getUserById(
    userId: string,
  ): Promise<AuthUserContext | null> {
    const result = await query<any>(
      "SELECT * FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Synchronize / Upsert Google OAuth authenticated user from Supabase Auth
   * Security Hardening:
   * - Never allows client-driven ADMIN role selection
   * - Never silently changes an existing user's role
   * - Validates email and authId consistency
   */
  public async syncGoogleUser(data: {
    authId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    role?: UserRole;
  }): Promise<AuthUserContext> {
    if (data.role === UserRole.ADMIN) {
      throw new AppError(
        "Self-assignment of ADMIN role via OAuth is strictly prohibited.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const normalizedEmail = data.email.trim().toLowerCase();

    // 1. If user already exists by auth_id, NEVER change or overwrite their role!
    const existing = await this.getUserByAuthId(data.authId);
    if (existing) {
      if (!existing.isActive) {
        throw new AppError(
          "Your NEARVIA account has been suspended or deactivated. Contact support.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
      if (data.fullName || data.avatarUrl) {
        await query(
          `UPDATE users SET 
            full_name = COALESCE($1, full_name),
            avatar_url = COALESCE($2, avatar_url),
            updated_at = NOW()
           WHERE auth_id = $3`,
          [data.fullName || null, data.avatarUrl || null, data.authId],
        );
      }
      const refreshed = await this.getUserByAuthId(data.authId);
      return refreshed || existing;
    }

    // 2. Check if user already exists by email (prevent duplicate identities)
    const existingByEmail = await query<any>(
      "SELECT * FROM users WHERE LOWER(email) = $1",
      [normalizedEmail],
    );
    if (existingByEmail.rows.length > 0) {
      const row = existingByEmail.rows[0];
      if (!row.is_active) {
        throw new AppError(
          "Your NEARVIA account has been suspended or deactivated. Contact support.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
      if (row.role === UserRole.ADMIN) {
        throw new AppError(
          "Administrative accounts cannot be claimed or linked via public OAuth profile synchronization.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
      if (!row.auth_id || row.auth_id === data.authId) {
        // Link authId to existing database record, PRESERVING existing role
        await query(
          "UPDATE users SET auth_id = $1, updated_at = NOW() WHERE id = $2",
          [data.authId, row.id],
        );
        const linked = await this.getUserById(row.id);
        if (linked) return linked;
      } else {
        throw new AppError(
          "An account with this email is already registered to a different identity.",
          409,
          ErrorCode.CONFLICT,
        );
      }
    }

    // 3. New user registration via Google OAuth:
    const requestedRole = data.role || UserRole.WORKER;
    if (![UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(requestedRole)) {
      throw new AppError(
        "Role must be WORKER, PROVIDER, or AGENT.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const fullName = data.fullName || normalizedEmail.split("@")[0] || "Nearvia User";

    const result = await query<any>(
      `INSERT INTO users (
        auth_id, phone, full_name, email, role, avatar_url, 
        email_verified, email_verified_at,
        mobile_verified, identity_verified, profile_completed, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), FALSE, FALSE, FALSE, TRUE)
      RETURNING *`,
      [
        data.authId,
        null,
        fullName,
        normalizedEmail,
        requestedRole,
        data.avatarUrl ?? null,
      ],
    );

    const userRow = result.rows[0];
    if (!userRow) {
      throw new AppError("Failed to synchronize user account.", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    if (requestedRole === UserRole.WORKER) {
      await query(
        `INSERT INTO worker_profiles (user_id, service_radius_km, location, address_approximate) 
         VALUES ($1, 5.0, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id],
      );
    } else if (requestedRole === UserRole.PROVIDER) {
      await query(
        `INSERT INTO provider_profiles (user_id, provider_type, business_name, location, address_approximate) 
         VALUES ($1, 'INDIVIDUAL', $2, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id, fullName],
      );
    } else if (requestedRole === UserRole.AGENT) {
      await query(
        `INSERT INTO agent_profiles (user_id, assigned_area, active_status, location, address_approximate) 
         VALUES ($1, 'Central Service Area', TRUE, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id],
      );
    }

    return this.mapUserRow(userRow);
  }

  /**
   * Verify mobile number for authenticated user
   */
  public async verifyMobile(userId: string, phone: string): Promise<AuthUserContext> {
    const normalizedPhone = phone.trim();
    const dupCheck = await query<any>(
      "SELECT id FROM users WHERE phone = $1 AND id != $2 LIMIT 1",
      [normalizedPhone, userId],
    );
    if (dupCheck.rows.length > 0) {
      throw new AppError(
        "Phone number is already associated with another account.",
        409,
        ErrorCode.CONFLICT,
      );
    }

    const result = await query<any>(
      `UPDATE users SET 
        phone = $1, 
        mobile_verified = TRUE, 
        mobile_verified_at = NOW(),
        updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [normalizedPhone, userId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      throw new AppError("User profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Unified email/password login
   * Verifies identity with Supabase Auth and checks local user active status
   */
  public async login(input: {
    email?: string;
    emailOrPhone?: string;
    password?: string;
  }): Promise<{ token: string; user: AuthUserContext }> {
    const target = (input.email || input.emailOrPhone || "").trim().toLowerCase();
    if (!target) {
      throw new AppError("Email or phone is required.", 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!input.password || input.password.length < 6) {
      throw new AppError("Invalid email or password.", 401, ErrorCode.UNAUTHORIZED);
    }

    const supabase = getSupabaseServerClient();
    let token: string;
    let authId: string | null = null;

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: target,
        password: input.password,
      });

      if (error || !data.session) {
        throw new AppError("Invalid email or password.", 401, ErrorCode.UNAUTHORIZED);
      }
      token = data.session.access_token;
      authId = data.user.id;
    } else {
      token = `mock_token_${target.replace(/[^a-zA-Z0-9]/g, "_")}`;
    }

    const user = authId
      ? await this.getUserByAuthId(authId)
      : (await query<any>("SELECT * FROM users WHERE LOWER(email) = $1", [target])).rows[0]
        ? this.mapUserRow((await query<any>("SELECT * FROM users WHERE LOWER(email) = $1", [target])).rows[0])
        : null;

    if (!user) {
      throw new AppError("Invalid email or password.", 401, ErrorCode.UNAUTHORIZED);
    }

    if (!user.isActive) {
      throw new AppError(
        "Your NEARVIA account has been suspended or deactivated. Contact support.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    return { token, user };
  }

  /**
   * Verify identity (Demo KYC / Verified ID)
   * Hardened: Hashes raw identification reference (Aadhaar/PAN) to prevent plain-text PII storage.
   */
  public async verifyIdentity(
    userId: string,
    reference?: string,
  ): Promise<AuthUserContext> {
    const sanitizedRef = reference?.trim()
      ? `DEMO_REF_${crypto.createHash("sha256").update(reference.trim()).digest("hex").slice(0, 12).toUpperCase()}`
      : `DEMO_KYC_${Date.now()}`;

    const result = await query<any>(
      `UPDATE users SET 
        identity_verified = TRUE, 
        identity_verified_at = NOW(),
        verification_provider = 'NEARVIA_DEMO_KYC',
        verification_reference = $1,
        profile_completed = TRUE,
        updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [sanitizedRef, userId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      throw new AppError("User profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Update Profile Details
   */
  public async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phone?: string;
      language?: string;
      locationText?: string;
      latitude?: number;
      longitude?: number;
    },
  ): Promise<AuthUserContext> {
    const result = await query<any>(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        language = COALESCE($3, language),
        location_text = COALESCE($4, location_text),
        latitude = COALESCE($5, latitude),
        longitude = COALESCE($6, longitude),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        data.fullName ?? null,
        data.phone ?? null,
        data.language ?? null,
        data.locationText ?? null,
        data.latitude ?? null,
        data.longitude ?? null,
        userId,
      ],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      throw new AppError("User profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Resend Supabase Email Verification
   * Secure, rate-limited, and does not leak account existence.
   */
  public async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdminClient() || getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase.auth.resend({
          type: "signup",
          email: normalizedEmail,
        });
      } catch (err) {
        console.warn("[AuthService] Supabase resend verification email error:", err);
      }
    }

    return {
      success: true,
      message: "If an unconfirmed account exists with this email, a verification link has been sent.",
    };
  }

  private mapUserRow(row: any): AuthUserContext {
    return {
      id: row.id,
      authId: row.auth_id,
      phone: row.phone ?? undefined,
      fullName: row.full_name,
      email: row.email ?? undefined,
      role: row.role as UserRole,
      avatarUrl: row.avatar_url ?? undefined,
      language: row.language ?? "English",
      locationText: row.location_text ?? undefined,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      emailVerified: Boolean(row.email_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at).toISOString() : undefined,
      mobileVerified: Boolean(row.mobile_verified),
      mobileVerifiedAt: row.mobile_verified_at ? new Date(row.mobile_verified_at).toISOString() : undefined,
      identityVerified: Boolean(row.identity_verified),
      identityVerifiedAt: row.identity_verified_at ? new Date(row.identity_verified_at).toISOString() : undefined,
      verificationProvider: row.verification_provider ?? undefined,
      verificationReference: row.verification_reference ?? undefined,
      profileCompleted: Boolean(row.profile_completed),
      isDemo: Boolean(row.is_demo),
      isActive: Boolean(row.is_active),
    };
  }
}

export const authService = new AuthService();
