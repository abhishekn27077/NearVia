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
   * Create a new notification for a recipient with automatic deduplication and sensitive data filtering.
   */
  public async createNotification(
    recipientId: string,
    type: string,
    title: string,
    message: string,
    data: Record<string, any> = {},
  ): Promise<string> {
    try {
      const sanitizedTitle = sanitizeText(title);
      const sanitizedMessage = sanitizeText(message);
      const sanitizedData = sanitizeNotificationData(data);

      const eventId = sanitizedData.eventId || null;
      const workOppId = sanitizedData.workOpportunityId || null;
      const assignmentId = sanitizedData.assignmentId || null;

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
        [recipientId, type, sanitizedTitle, sanitizedMessage, JSON.stringify(sanitizedData)],
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

export const NotificationType = {
  NEW_APPLICATION: "NEW_APPLICATION",
  APPLICATION_ACCEPTED: "APPLICATION_ACCEPTED",
  APPLICATION_REJECTED: "APPLICATION_REJECTED",
  APPLICATION_WITHDRAWN: "APPLICATION_WITHDRAWN",
  APPLICATION_SHORTLISTED: "APPLICATION_SHORTLISTED",
  ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
  ASSIGNMENT_CANCELLED: "ASSIGNMENT_CANCELLED",
  WORKER_CONFIRMED: "WORKER_CONFIRMED",
  WORKER_CHECKED_IN: "WORKER_CHECKED_IN",
  JOB_PIN_VERIFIED: "JOB_PIN_VERIFIED",
  SHIFT_CHECKED_OUT: "SHIFT_CHECKED_OUT",
  SHIFT_COMPLETED: "SHIFT_COMPLETED",
  COMPLETION_CONFIRMED: "COMPLETION_CONFIRMED",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_ESCROWED: "PAYMENT_ESCROWED",
  PAYMENT_RELEASED: "PAYMENT_RELEASED",
  PAYMENT_SETTLED: "PAYMENT_SETTLED",
  CASH_PAID: "CASH_PAID",
  PAYMENT_DISPUTED: "PAYMENT_DISPUTED",
  NEW_REVIEW: "NEW_REVIEW",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  DISPUTE_RESOLVED: "DISPUTE_RESOLVED",
  REPORT_STATUS_UPDATED: "REPORT_STATUS_UPDATED",
  AGENT_ACCESS_REQUEST: "AGENT_ACCESS_REQUEST",
  AGENT_REQUEST_ACCEPTED: "AGENT_REQUEST_ACCEPTED",
  AGENT_ACCESS_REVOKED: "AGENT_ACCESS_REVOKED",
  AGENT_ASSISTED_APPLICATION: "AGENT_ASSISTED_APPLICATION",
  AGENT_WORKER_HIRED: "AGENT_WORKER_HIRED",
  NEW_MESSAGE: "NEW_MESSAGE",
  SHIFT_REMINDER: "SHIFT_REMINDER",
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "auth_token",
  "refreshtoken",
  "privateaddress",
  "private_address",
  "fulladdress",
  "full_address",
  "pin",
  "otp",
  "bankaccount",
  "bank_account",
  "ifsc",
  "authid",
  "auth_id",
]);

function sanitizeNotificationData(data: Record<string, any>): Record<string, any> {
  if (!data || typeof data !== "object") return {};
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      continue; // omit sensitive keys completely
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeNotificationData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED_TOKEN]")
    .replace(/(?:password|secret|token)\s*[:=]\s*[^\s,]+/gi, "[REDACTED]");
}

export const notificationsService = new NotificationsService();

