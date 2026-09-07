/**
 * Notifications Controller
 * Handles user notification retrieval and status updates.
 */

import { Request, Response, NextFunction } from "express";
import { notificationsService } from "./service";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";

export class NotificationsController {
  /**
   * GET /api/v1/notifications
   */
  public async getMyNotifications(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const limit = parseInt(req.query.limit as string, 10) || 20;
      const data = await notificationsService.getMyNotifications(req.user.id, limit);

      const response: ApiResponse<typeof data> = {
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  public async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const rawId = req.params.id;
      const notificationId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!notificationId) {
        throw new AppError("Notification ID is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const updated = await notificationsService.markAsRead(req.user.id, notificationId);

      const response: ApiResponse<{ updated: boolean }> = {
        success: true,
        data: { updated },
        meta: { timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/read-all
   */
  public async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const count = await notificationsService.markAllAsRead(req.user.id);

      const response: ApiResponse<{ markedCount: number }> = {
        success: true,
        data: { markedCount: count },
        meta: { timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
