import { query } from "../db";

export type PlatformEventType =
  | "USER_REGISTERED"
  | "PROFILE_COMPLETED"
  | "WORK_PUBLISHED"
  | "WORK_VIEWED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_ACCEPTED"
  | "ASSIGNMENT_CREATED"
  | "WORK_STARTED"
  | "WORK_COMPLETED"
  | "PAYMENT_SUCCESS"
  | "REVIEW_SUBMITTED"
  | "DISPUTE_RAISED"
  | "REPORT_FILED";

export interface TrackEventParams {
  eventType: PlatformEventType;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Track meaningful platform product events with privacy data minimization
 */
export async function trackPlatformEvent(params: TrackEventParams): Promise<void> {
  try {
    await query(
      `INSERT INTO platform_events (event_type, user_id, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.eventType,
        params.userId || null,
        params.resourceType || null,
        params.resourceId || null,
        JSON.stringify(params.metadata || {}),
        params.ipAddress || null,
      ]
    );
  } catch (err) {
    // Non-blocking logging failure
    console.error("[Events] Failed to record platform event:", err);
  }
}
