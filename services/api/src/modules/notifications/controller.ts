/**
 * Notifications Controller
 * Handles user notification retrieval and status updates.
 */

import { Request, Response, NextFunction } from "express";
import { notificationsService } from "./service";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";
import { validateUuid, clampPagination } from "../../utils/security";

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

      const { limit } = clampPagination(req.query, 20, 50);
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
   * GET /api/v1/notifications/unread-count
   */
  public async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const unreadCount = await notificationsService.getUnreadCount(req.user.id);

      const response: ApiResponse<{ unreadCount: number }> = {
        success: true,
        data: { unreadCount },
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

      const notificationId = validateUuid(req.params.id, "Notification ID");

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
