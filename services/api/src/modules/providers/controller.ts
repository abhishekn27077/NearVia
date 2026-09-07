/**
 * Providers Module Controller
 * Handles HTTP requests for Provider Profile and Location.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { ProviderProfileDetail } from "@nearvia/types";
import { providersService } from "./service";
import { AppError } from "../../middleware/errorHandler";

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

      const lat = req.query.latitude ? parseFloat(req.query.latitude as string) : undefined;
      const lng = req.query.longitude ? parseFloat(req.query.longitude as string) : undefined;
      const radius = req.query.radius ? parseFloat(req.query.radius as string) : 5.0;
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

      const workerId = (req.params.workerId || "") as string;
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

      const workerId = (req.params.workerId || "") as string;
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
      const providerId = (req.params.providerId || "") as string;
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
