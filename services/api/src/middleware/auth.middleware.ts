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

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(
      new AppError(
        "Authentication required. Missing Bearer token.",
        401,
        ErrorCode.UNAUTHORIZED,
      ),
    );
    return;
  }

  const token = authHeader.split(" ")[1];
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
      phone: string;
      full_name: string;
      email: string | null;
      role: UserRole;
      is_active: boolean;
    }>(
      "SELECT id, auth_id, phone, full_name, email, role, is_active FROM users WHERE auth_id = $1",
      [verified.authId],
    );

    if (result.rows.length === 0) {
      next(
        new AppError(
          "User identity authenticated but NEARVIA application profile not found.",
          401,
          ErrorCode.UNAUTHORIZED,
        ),
      );
      return;
    }

    const userRow = result.rows[0];
    if (!userRow) {
      next(
        new AppError("User profile not found.", 401, ErrorCode.UNAUTHORIZED),
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

    req.user = {
      id: userRow.id,
      authId: userRow.auth_id,
      phone: userRow.phone,
      fullName: userRow.full_name,
      email: userRow.email ?? undefined,
      role: userRow.role,
      isActive: userRow.is_active,
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
