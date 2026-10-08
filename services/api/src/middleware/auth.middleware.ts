/**
 * Authentication and Role-Based Authorization Middleware
 * Enforces server-side token validation and role-based access control.
 */

import { Request, Response, NextFunction } from "express";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { ErrorCode } from "@nearvia/config";
import { verifySupabaseToken } from "../services/supabase.service";
import { query } from "../db";
import { AppError } from "./errorHandler";

// Extend Express Request interface with authenticated user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserContext;
    }
  }
}

/**
 * Authentication Middleware
 * Validates Bearer token, fetches active user from PostgreSQL, and attaches req.user.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.match(/^Bearer\s+/i)) {
    next(
      new AppError(
        "Authentication required. Missing Bearer token.",
        401,
        ErrorCode.UNAUTHORIZED,
      ),
    );
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    next(
      new AppError(
        "Authentication required. Invalid token format.",
        401,
        ErrorCode.UNAUTHORIZED,
      ),
    );
    return;
  }

  try {
    const verified = await verifySupabaseToken(token);
    if (!verified) {
      next(
        new AppError(
          "Invalid or expired authentication token.",
          401,
          ErrorCode.UNAUTHORIZED,
        ),
      );
      return;
    }

    // Look up application user from PostgreSQL users table by auth_id
    const result = await query<{
      id: string;
      auth_id: string;
      phone: string | null;
      full_name: string;
      email: string | null;
      role: UserRole;
      is_active: boolean;
      email_verified?: boolean;
    }>(
      "SELECT id, auth_id, phone, full_name, email, role, is_active, email_verified FROM users WHERE auth_id = $1",
      [verified.authId],
    );

    let userRow: any = result.rows[0];

    if (!userRow) {
      // Auto-provision application user from confirmed Supabase Auth identity
      try {
        const rawRole = verified.userMetadata?.role;
        const safeRole = [UserRole.WORKER, UserRole.PROVIDER, UserRole.AGENT].includes(rawRole)
          ? rawRole
          : UserRole.WORKER;
        const fullName =
          verified.userMetadata?.full_name ||
          verified.userMetadata?.name ||
          (verified.email ? verified.email.split("@")[0] : "Nearvia User");
        const phone = verified.phone || verified.userMetadata?.phone || null;
        const isEmailVerified = Boolean(verified.emailVerified);

        const insertResult = await query<{
          id: string;
          auth_id: string;
          phone: string | null;
          full_name: string;
          email: string | null;
          role: UserRole;
          is_active: boolean;
          email_verified: boolean;
        }>(
          `INSERT INTO users (
            auth_id, phone, full_name, email, role,
            email_verified, email_verified_at,
            mobile_verified, identity_verified, profile_completed, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, FALSE, FALSE, TRUE)
          ON CONFLICT (auth_id) DO UPDATE SET
            email_verified = EXCLUDED.email_verified,
            email_verified_at = COALESCE(users.email_verified_at, EXCLUDED.email_verified_at)
          RETURNING id, auth_id, phone, full_name, email, role, is_active, email_verified`,
          [
            verified.authId,
            phone,
            fullName,
            verified.email || null,
            safeRole,
            isEmailVerified,
            isEmailVerified ? new Date() : null,
          ],
        );

        if (insertResult.rows.length > 0) {
          userRow = insertResult.rows[0];

          // Initialize domain profile record
          if (safeRole === UserRole.WORKER) {
            await query(
              `INSERT INTO worker_profiles (user_id, service_radius_km, availability_status, is_available_now, location, address_approximate)
               VALUES ($1, 5.0, 'OFFLINE', FALSE, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central')
               ON CONFLICT (user_id) DO NOTHING`,
              [userRow.id],
            ).catch(() => {});
          } else if (safeRole === UserRole.PROVIDER) {
            await query(
              `INSERT INTO provider_profiles (user_id, provider_type, business_name, location, address_approximate)
               VALUES ($1, 'INDIVIDUAL', $2, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central')
               ON CONFLICT (user_id) DO NOTHING`,
              [userRow.id, userRow.full_name],
            ).catch(() => {});
          } else if (safeRole === UserRole.AGENT) {
            await query(
              `INSERT INTO agent_profiles (user_id, assigned_area, active_status, location, address_approximate)
               VALUES ($1, 'Central Service Area', TRUE, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Bengaluru Central')
               ON CONFLICT (user_id) DO NOTHING`,
              [userRow.id],
            ).catch(() => {});
          }
        }
      } catch (autoErr) {
        console.warn("[AuthMiddleware] Auto-provision warning:", autoErr);
      }
    }

    if (!userRow) {
      next(
        new AppError(
          "User identity authenticated but NEARVIA application profile not found.",
          401,
          ErrorCode.UNAUTHORIZED,
        ),
      );
      return;
    }

    // Check account active status (Section 7: Suspended/Deactivated users must be blocked)
    if (!userRow.is_active) {
      next(
        new AppError(
          "Your NEARVIA account has been suspended or deactivated. Contact support.",
          403,
          ErrorCode.FORBIDDEN,
        ),
      );
      return;
    }

    const isEmailVerified = Boolean(userRow.email_verified || verified.emailVerified);
    if (verified.emailVerified && !userRow.email_verified) {
      // Synchronize verified state from Supabase Auth to PostgreSQL
      query("UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = $1", [userRow.id]).catch(() => {});
    }

    req.user = {
      id: userRow.id,
      authId: userRow.auth_id,
      phone: userRow.phone ?? undefined,
      fullName: userRow.full_name,
      email: userRow.email ?? undefined,
      role: userRow.role,
      isActive: userRow.is_active,
      emailVerified: isEmailVerified,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-Based Authorization Middleware
 * Ensures the authenticated user possesses the required role.
 */
export function requireRole(allowedRole: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(
        new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED),
      );
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(
        new AppError(
          `Access denied. Requires one of roles: [${roles.join(", ")}]. Your role: ${req.user.role}.`,
          403,
          ErrorCode.FORBIDDEN,
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Multi-Role Authorization Helper
 */
export const requireAnyRole = requireRole;

/**
 * Require Verified Email Middleware
 * Ensures the authenticated user possesses a verified email address.
 */
export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED));
    return;
  }

  if (!req.user.emailVerified) {
    next(
      new AppError(
        "Email verification required. Please verify your email address to access this resource.",
        403,
        ErrorCode.FORBIDDEN,
      ),
    );
    return;
  }

  next();
}
