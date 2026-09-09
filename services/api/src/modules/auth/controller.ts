/**
 * Auth Module Controller
 * Coordinates HTTP requests for registration, profile sync, verification, and session status.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { authService } from "./service";
import { AppError } from "../../middleware/errorHandler";
import { verifySupabaseToken } from "../../services/supabase.service";

export class AuthController {
  /**
   * POST /api/v1/auth/signup
   * Direct unified signup endpoint that creates Supabase Auth user & application profile
   */
  public async signUp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = await authService.signUpWithEmail(req.body);
      const response: ApiResponse<AuthUserContext> = {
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Unified email/password authentication
   */
  public async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await authService.login(req.body);
      const response: ApiResponse<{ token: string; user: AuthUserContext }> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/confirm-email
   */
  public async confirmEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const email = req.body.email;
      if (!email) {
        throw new AppError("Email is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      let authenticatedEmail: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.match(/^Bearer\s+/i)) {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (token) {
          const verified = await verifySupabaseToken(token);
          if (verified?.email) {
            authenticatedEmail = verified.email;
          }
        }
      }

      await authService.confirmUserEmail(email, authenticatedEmail);
      res.json({ success: true, message: "Email confirmed" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/resend-verification-email
   * Resends Supabase account verification email
   */
  public async resendVerificationEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const email = req.body.email;
      if (!email) {
        throw new AppError("Email is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const result = await authService.resendVerificationEmail(email);
      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/register
   */
  public async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // If a Bearer token is provided, verify it and ensure authId and email cannot be forged
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.match(/^Bearer\s+/i)) {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (token) {
          const verified = await verifySupabaseToken(token);
          if (!verified) {
            throw new AppError(
              "Invalid or expired authentication token.",
              401,
              ErrorCode.UNAUTHORIZED,
            );
          }
          if (req.body.authId && req.body.authId !== verified.authId) {
            throw new AppError(
              "Identity mismatch. Provided authId does not match verified token.",
              403,
              ErrorCode.FORBIDDEN,
            );
          }
          if (
            req.body.email &&
            verified.email &&
            req.body.email.trim().toLowerCase() !== verified.email.trim().toLowerCase()
          ) {
            throw new AppError(
              "Identity mismatch. Provided email does not match verified token.",
              403,
              ErrorCode.FORBIDDEN,
            );
          }
        }
      }

      const user = await authService.registerUser(req.body);
      const response: ApiResponse<AuthUserContext> = {
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns current authenticated user context.
   */
  public async getMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        next(
          new AppError("User not authenticated.", 401, ErrorCode.UNAUTHORIZED),
        );
        return;
      }

      // Fetch fresh profile state from database
      const freshUser = await authService.getUserById(req.user.id);

      const response: ApiResponse<AuthUserContext> = {
        success: true,
        data: freshUser || req.user,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/sync-google-profile
   * Synchronizes user authenticated via Google OAuth with local PostgreSQL profile.
   * Security Hardening:
   * - Strictly requires and validates Bearer token from Supabase Auth
   * - Derives authId from verified token, rejecting client authId forgery
   * - Strictly rejects any attempt to self-assign ADMIN role
   */
  public async syncGoogleProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.match(/^Bearer\s+/i)) {
        throw new AppError(
          "Authentication required. Missing Supabase Bearer token.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        throw new AppError(
          "Authentication required. Invalid token format.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const verified = await verifySupabaseToken(token);
      if (!verified) {
        throw new AppError(
          "Invalid or expired Supabase authentication token.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      // If client supplied authId, verify it matches verified identity (prevent IDOR)
      const clientAuthId = req.body.authId;
      if (clientAuthId && clientAuthId !== verified.authId) {
        throw new AppError(
          "Identity mismatch. Provided authId does not match verified token.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      // If client supplied email, verify it matches verified token email (prevent email spoofing / account hijacking)
      const clientEmail = req.body.email;
      if (
        clientEmail &&
        verified.email &&
        clientEmail.trim().toLowerCase() !== verified.email.trim().toLowerCase()
      ) {
        throw new AppError(
          "Identity mismatch. Provided email does not match verified token.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      const { fullName, avatarUrl, role } = req.body;

      // Reject attempts to request ADMIN role
      if (role === UserRole.ADMIN) {
        throw new AppError(
          "Public registration or OAuth profile sync as ADMIN is strictly prohibited.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      // Authoritative email derived directly from verified token
      const email = verified.email || req.body.email;
      if (!email) {
        throw new AppError(
          "Verified email is required for OAuth profile synchronization.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      // Check if user is already deactivated/suspended
      const existingUser = await authService.getUserByAuthId(verified.authId);
      if (existingUser && !existingUser.isActive) {
        throw new AppError(
          "Your NEARVIA account has been suspended or deactivated. Contact support.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      const user = await authService.syncGoogleUser({
        authId: verified.authId,
        email,
        fullName: fullName || verified.email?.split("@")[0],
        avatarUrl,
        role: role as UserRole,
      });

      res.status(200).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/send-otp
   * Request OTP code for progressive mobile verification
   */
  public async sendOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const { phone } = req.body;
      if (!phone) {
        throw new AppError("Phone number is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
      const { otpService } = await import("../otp/service");
      const result = await otpService.sendOtp(req.user.id, phone, clientIp);

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Verify entered OTP code and set mobile_verified = TRUE
   */
  public async verifyOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const { phone, otp } = req.body;
      if (!phone || !otp) {
        throw new AppError("Both phone and otp are required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
      const { otpService } = await import("../otp/service");
      const user = await otpService.verifyOtp(req.user.id, phone, otp, clientIp);

      res.status(200).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Resend OTP code respecting cooldown window
   */
  public async resendOtp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const { phone } = req.body;
      if (!phone) {
        throw new AppError("Phone number is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
      const { otpService } = await import("../otp/service");
      const result = await otpService.sendOtp(req.user.id, phone, clientIp);

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-mobile (Backward compatible endpoint)
   */
  public async verifyMobile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const { phone, otp } = req.body;
      if (!phone) {
        throw new AppError("Phone number is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      if (otp) {
        const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
        const { otpService } = await import("../otp/service");
        const user = await otpService.verifyOtp(req.user.id, phone, otp, clientIp);
        res.status(200).json({
          success: true,
          data: user,
          meta: { timestamp: new Date().toISOString() },
        });
        return;
      }

      if (process.env.NODE_ENV === "production") {
        throw new AppError(
          "OTP verification code is required to verify mobile number.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const user = await authService.verifyMobile(req.user.id, phone);
      res.status(200).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/verify-identity
   */
  public async verifyIdentity(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const { reference } = req.body;
      const user = await authService.verifyIdentity(req.user.id, reference);
      res.status(200).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/auth/profile
   */
  public async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const user = await authService.updateProfile(req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  public async logout(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: { message: "Session terminated successfully." },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
