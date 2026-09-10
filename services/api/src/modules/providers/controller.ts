/**
 * Providers Module Controller
 * Handles HTTP requests for Provider Profile and Location.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { ProviderProfileDetail } from "@nearvia/types";
import { providersService } from "./service";
import { AppError } from "../../middleware/errorHandler";
import { validateUuid } from "../../utils/security";

export class ProvidersController {
  /**
   * GET /api/v1/providers/me
   */
  public async getMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const profile = await providersService.getProviderProfileDetail(
        req.user.id,
      );
      const response: ApiResponse<ProviderProfileDetail> = {
        success: true,
        data: profile,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/providers/me
   */
  public async updateMe(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const updated = await providersService.updateProviderProfile(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<ProviderProfileDetail> = {
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/providers/me/location
   */
  public async updateLocation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const updated = await providersService.updateProviderLocation(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<ProviderProfileDetail> = {
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/providers/workforce-radar
   */
  public async getWorkforceRadar(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      let lat: number | undefined;
      let lng: number | undefined;
      const rawLat = req.query.latitude;
      const rawLng = req.query.longitude;

      if (rawLat !== undefined || rawLng !== undefined) {
        if (rawLat === undefined || rawLng === undefined) {
          throw new AppError(
            "Both latitude and longitude must be provided together.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        lat = parseFloat(rawLat as string);
        lng = parseFloat(rawLng as string);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          throw new AppError(
            "Latitude must be a valid number between -90 and 90 degrees.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          throw new AppError(
            "Longitude must be a valid number between -180 and 180 degrees.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }

      const rawRadius = req.query.radius || req.query.radiusKm;
      let radius = 5.0;
      if (rawRadius !== undefined) {
        radius = parseFloat(rawRadius as string);
        if (isNaN(radius) || radius < 0.5 || radius > 15.0) {
          throw new AppError(
            "Search radius must be between 0.5 km and 15 km.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }

      const categoryId = req.query.categoryId as string | undefined;

      const radarData = await providersService.getWorkforceRadar(
        req.user.id,
        lat,
        lng,
        radius,
        categoryId,
      );

      res.status(200).json({
        success: true,
        data: radarData,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/providers/preferred-workers
   */
  public async getPreferredWorkers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const list = await providersService.getPreferredWorkers(req.user.id);
      res.status(200).json({
        success: true,
        data: list,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/providers/preferred-workers/:workerId
   */
  public async addPreferredWorker(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const workerId = validateUuid(req.params.workerId, "worker ID");
      const { notes } = req.body;
      const result = await providersService.addPreferredWorker(req.user.id, workerId, notes);

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
   * DELETE /api/v1/providers/preferred-workers/:workerId
   */
  public async removePreferredWorker(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const workerId = validateUuid(req.params.workerId, "worker ID");
      const result = await providersService.removePreferredWorker(req.user.id, workerId);

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
   * GET /api/v1/providers/:providerId/reputation
   */
  public async getProviderReputation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const providerId = validateUuid(req.params.providerId, "Provider ID");
      const reputation = await providersService.getProviderReputation(providerId);

      res.status(200).json({
        success: true,
        data: reputation,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const providersController = new ProvidersController();
