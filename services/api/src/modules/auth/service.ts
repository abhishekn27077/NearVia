/**
 * Auth Module Domain Service
 * Handles application user synchronization, registration rules, verification states, and session queries.
 */

import { AuthUserContext, UserRole } from "@nearvia/types";
import { RegisterRequestInput } from "@nearvia/validation";
import { ErrorCode } from "@nearvia/config";
import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { getSupabaseServerClient } from "../../services/supabase.service";

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

    const supabase = getSupabaseServerClient();
    let authId: string;

    if (supabase) {
      try {
        const { data: userList } = await supabase.auth.admin.listUsers();
        const existingAuth = userList?.users?.find(
          (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
        );

        if (existingAuth) {
          authId = existingAuth.id;
          if (input.password) {
            await supabase.auth.admin.updateUserById(authId, {
              password: input.password,
              email_confirm: true,
              user_metadata: { full_name: input.fullName, role: input.role },
            });
          }
        } else {
          const { data: newAuth, error: createError } =
            await supabase.auth.admin.createUser({
              email: input.email.trim(),
              password: input.password || "NearviaUser2026!",
              email_confirm: true,
              user_metadata: {
                full_name: input.fullName,
                role: input.role,
              },
            });

          if (createError || !newAuth.user) {
            throw new AppError(
              createError?.message || "Failed to provision authentication account.",
              400,
              ErrorCode.UNAUTHORIZED,
            );
          }
          authId = newAuth.user.id;
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          err.message || "Failed to connect to authentication provider.",
          500,
          ErrorCode.INTERNAL_SERVER_ERROR,
        );
      }
    } else {
      authId = `user_${Date.now()}`;
    }

    const phone = input.phone || `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

    return this.registerUser({
      authId,
      phone,
      fullName: input.fullName,
      email: input.email.trim(),
      role: roleValue as UserRole.WORKER | UserRole.PROVIDER | UserRole.AGENT,
    });
  }

  /**
   * Auto-confirms user email in Supabase Auth if unconfirmed
   */
  public async confirmUserEmail(email: string): Promise<boolean> {
    const supabase = getSupabaseServerClient();
    if (!supabase) return true;

    try {
      const { data: userList } = await supabase.auth.admin.listUsers();
      const user = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email.trim().toLowerCase(),
      );

      if (user) {
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      }
      return true;
    } catch {
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

    // Check for existing user by auth_id or phone
    const existing = await query<{
      id: string;
      auth_id: string;
      phone: string;
    }>(
      "SELECT id, auth_id, phone FROM users WHERE auth_id = $1 OR phone = $2",
      [data.authId, data.phone],
    );

    if (existing.rows.length > 0) {
      // If already registered with this auth_id, return existing profile
      const existingUser = await this.getUserByAuthId(data.authId);
      if (existingUser) return existingUser;

      throw new AppError(
        "A NEARVIA user account with this authentication identity or phone number already exists.",
        409,
        ErrorCode.CONFLICT,
      );
    }

    // Insert user into PostgreSQL users table
    const result = await query<any>(
      `INSERT INTO users (
        auth_id, phone, full_name, email, role, avatar_url, 
        mobile_verified, identity_verified, profile_completed, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE, FALSE, TRUE)
      RETURNING *`,
      [
        data.authId,
        data.phone,
        data.fullName,
        data.email ?? null,
        data.role,
        data.avatarUrl ?? null,
      ],
    );

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
   */
  public async syncGoogleUser(data: {
    authId: string;
    email: string;
    fullName?: string;
    avatarUrl?: string;
    role?: UserRole;
  }): Promise<AuthUserContext> {
    const existing = await this.getUserByAuthId(data.authId);
    if (existing) {
      return existing;
    }

    const defaultRole = data.role || UserRole.WORKER;
    const phone = "+91" + Math.floor(6000000000 + Math.random() * 3999999999).toString();
    const fullName = data.fullName || data.email.split("@")[0] || "Nearvia User";

    const result = await query<any>(
      `INSERT INTO users (
        auth_id, phone, full_name, email, role, avatar_url, 
        mobile_verified, identity_verified, profile_completed, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE, FALSE, TRUE)
      ON CONFLICT (auth_id) DO UPDATE SET 
        full_name = EXCLUDED.full_name, 
        email = EXCLUDED.email
      RETURNING *`,
      [
        data.authId,
        phone,
        fullName,
        data.email,
        defaultRole,
        data.avatarUrl ?? null,
      ],
    );

    const userRow = result.rows[0];
    if (!userRow) {
      throw new AppError("Failed to synchronize user account.", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    if (defaultRole === UserRole.WORKER) {
      await query(
        `INSERT INTO worker_profiles (user_id, service_radius_km, location, address_approximate) 
         VALUES ($1, 5.0, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id],
      );
    } else if (defaultRole === UserRole.PROVIDER) {
      await query(
        `INSERT INTO provider_profiles (user_id, provider_type, business_name, location, address_approximate) 
         VALUES ($1, 'INDIVIDUAL', $2, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central') 
         ON CONFLICT (user_id) DO NOTHING`,
        [userRow.id, fullName],
      );
    } else if (defaultRole === UserRole.AGENT) {
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
    const result = await query<any>(
      `UPDATE users SET 
        phone = $1, 
        mobile_verified = TRUE, 
        mobile_verified_at = NOW(),
        updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [phone, userId],
    );

    if (result.rows.length === 0 || !result.rows[0]) {
      throw new AppError("User profile not found.", 404, ErrorCode.NOT_FOUND);
    }

    return this.mapUserRow(result.rows[0]);
  }

  /**
   * Verify identity (Demo KYC / Verified ID)
   */
  public async verifyIdentity(
    userId: string,
    reference?: string,
  ): Promise<AuthUserContext> {
    const ref = reference || `DEMO_KYC_${Date.now()}`;
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
      [ref, userId],
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

  private mapUserRow(row: any): AuthUserContext {
    return {
      id: row.id,
      authId: row.auth_id,
      phone: row.phone,
      fullName: row.full_name,
      email: row.email ?? undefined,
      role: row.role as UserRole,
      avatarUrl: row.avatar_url ?? undefined,
      language: row.language ?? "English",
      locationText: row.location_text ?? undefined,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
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
