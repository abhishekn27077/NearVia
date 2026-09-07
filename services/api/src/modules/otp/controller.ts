/**
 * OTP Controller
 * Exposes API endpoints for progressive phone verification.
 */

import { Request, Response, NextFunction } from "express";
import { otpService } from "./service";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export class OTPController {
  /**
   * POST /api/v1/auth/send-otp
   * Request an SMS OTP code to verify mobile number
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
   * Verify entered OTP code and mark user mobile as verified
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
      const verifiedUser = await otpService.verifyOtp(req.user.id, phone, otp, clientIp);

      res.status(200).json({
        success: true,
        data: verifiedUser,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Resend OTP code with cooldown verification
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
}

export const otpController = new OTPController();
