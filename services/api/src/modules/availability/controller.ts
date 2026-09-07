/**
 * Availability Controller
 * Exposes endpoints for Worker Go Online / Go Offline & Availability Preferences
 */

import { Request, Response, NextFunction } from "express";
import { availabilityService } from "./service";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export class AvailabilityController {
  /**
   * POST /api/v1/availability/toggle
   */
  public async toggleAvailability(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const result = await availabilityService.toggleAvailability(req.user.id, req.body);
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
   * GET /api/v1/availability/me
   */
  public async getMyAvailability(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const result = await availabilityService.getWorkerAvailability(req.user.id);
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

export const availabilityController = new AvailabilityController();
