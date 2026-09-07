/**
 * Auth Module Controller
 * Coordinates HTTP requests for registration, profile sync, verification, and session status.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AuthUserContext } from "@nearvia/types";
import { authService } from "./service";
import { AppError } from "../../middleware/errorHandler";

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
   * POST /api/v1/auth/confirm-email
   */
  public async confirmEmail(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const email = req.body.email;
      if (email) {
        await authService.confirmUserEmail(email);
      }
      res.json({ success: true, message: "Email confirmed" });
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
   */
  public async syncGoogleProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { authId, email, fullName, avatarUrl, role } = req.body;
      if (!authId || !email) {
        throw new AppError("authId and email are required for profile synchronization.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const user = await authService.syncGoogleUser({
        authId,
        email,
        fullName,
        avatarUrl,
        role,
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
        const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
        const { otpService } = await import("../otp/service");
        const user = await otpService.verifyOtp(req.user.id, phone, otp, clientIp);
        res.status(200).json({
          success: true,
          data: user,
          meta: { timestamp: new Date().toISOString() },
        });
        return;
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
