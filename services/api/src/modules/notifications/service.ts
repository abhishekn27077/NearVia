/**
 * Notifications Service
 * Multi-channel notifications (in-app, SMS, push alerts) backed by PostgreSQL.
 */

import { query } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export interface NotificationItem {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export class NotificationsService {
  /**
   * List notifications for a given user with unread count.
   */
  public async getMyNotifications(
    userId: string,
    limit = 20,
  ): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    try {
      const listRes = await query<{
        id: string;
        recipient_id: string;
        type: string;
        title: string;
        message: string;
        data: any;
        is_read: boolean;
        read_at: string | null;
        created_at: string;
      }>(
        `SELECT id, recipient_id, type, title, message, data, is_read, read_at, created_at
         FROM notifications
         WHERE recipient_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit],
      );

      const countRes = await query<{ unread_count: string }>(
        `SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [userId],
      );

      const unreadCount = parseInt(countRes.rows[0]?.unread_count || "0", 10);

      const items: NotificationItem[] = listRes.rows.map((r) => ({
        id: r.id,
        recipientId: r.recipient_id,
        type: r.type,
        title: r.title,
        message: r.message,
        data: r.data,
        isRead: r.is_read,
        readAt: r.read_at,
        createdAt: r.created_at,
      }));

      return { items, unreadCount };
    } catch (err: any) {
      throw new AppError(
        `Failed to retrieve notifications: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Get total unread count for a given user.
   */
  public async getUnreadCount(userId: string): Promise<number> {
    try {
      const countRes = await query<{ unread_count: string }>(
        `SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [userId],
      );
      return parseInt(countRes.rows[0]?.unread_count || "0", 10);
    } catch (err: any) {
      throw new AppError(
        `Failed to retrieve unread notification count: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Mark a single notification as read with strict recipient ownership verification.
   */
  public async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const existing = await query<{ id: string; recipient_id: string }>(
        `SELECT id, recipient_id FROM notifications WHERE id = $1`,
        [notificationId],
      );

      if (!existing.rows[0]) {
        throw new AppError("Notification not found.", 404, ErrorCode.NOT_FOUND);
      }

      if (existing.rows[0].recipient_id !== userId) {
        throw new AppError(
          "You cannot mark another user's notification as read.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }

      const res = await query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE id = $1 AND recipient_id = $2`,
        [notificationId, userId],
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to update notification: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Mark all unread notifications for a user as read.
   */
  public async markAllAsRead(userId: string): Promise<number> {
    try {
      const res = await query(
        `UPDATE notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE recipient_id = $1 AND is_read = FALSE`,
        [userId],
      );
      return res.rowCount ?? 0;
    } catch (err: any) {
      throw new AppError(
        `Failed to mark notifications as read: ${err.message}`,
        500,
        ErrorCode.DATABASE_ERROR,
      );
    }
  }

  /**
   * Create a new notification for a recipient with automatic deduplication.
   */
  public async createNotification(
    recipientId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, any> = {},
  ): Promise<string> {
    try {
      const eventId = data.eventId || null;
      const workOppId = data.workOpportunityId || null;
      const assignmentId = data.assignmentId || null;

      // 1. Explicit eventId idempotency check
      if (eventId) {
        const dupEvent = await query<{ id: string }>(
          `SELECT id FROM notifications 
           WHERE recipient_id = $1 AND type = $2 AND data->>'eventId' = $3`,
          [recipientId, type, String(eventId)],
        );
        if (dupEvent.rows[0]) {
          return dupEvent.rows[0].id;
        }
      }

      // 2. Sliding window (2-minute) suppression for duplicate job/assignment events
      if (workOppId || assignmentId) {
        const dupRecent = await query<{ id: string }>(
          `SELECT id FROM notifications 
           WHERE recipient_id = $1 AND type = $2 
             AND created_at > NOW() - INTERVAL '2 minutes'
             AND (
               ($3::text IS NOT NULL AND data->>'workOpportunityId' = $3::text) OR
               ($4::text IS NOT NULL AND data->>'assignmentId' = $4::text)
             )
           LIMIT 1`,
          [recipientId, type, workOppId ? String(workOppId) : null, assignmentId ? String(assignmentId) : null],
        );
        if (dupRecent.rows[0]) {
          return dupRecent.rows[0].id;
        }
      }

      const res = await query<{ id: string }>(
        `INSERT INTO notifications (recipient_id, type, title, message, data, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
         RETURNING id`,
        [recipientId, type, title, message, JSON.stringify(data)],
      );
      return res?.rows?.[0]?.id || "";
    } catch (err: any) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Failed to insert notification:", err.message);
      }
      return "";
    }
  }
}

export const notificationsService = new NotificationsService();
