import { query } from "../db";

export type PlatformEventType =
  | "USER_REGISTERED"
  | "PROFILE_COMPLETED"
  | "WORK_PUBLISHED"
  | "WORK_VIEWED"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_ACCEPTED"
  | "WORKER_SELECTED"
  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_CONFIRMED"
  | "WORKER_CHECKED_IN"
  | "WORKER_CHECKED_OUT"
  | "JOB_PIN_VERIFIED"
  | "JOB_PIN_FAILED"
  | "WORK_STARTED"
  | "WORK_COMPLETED"
  | "PROVIDER_CONFIRMED_COMPLETION"
  | "SETTLEMENT_PENDING"
  | "ASSIGNMENT_CANCELLED"
  | "PAYMENT_SUCCESS"
  | "REVIEW_SUBMITTED"
  | "DISPUTE_RAISED"
  | "REPORT_FILED";

export interface TrackEventParams {
  eventType: PlatformEventType;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, any>;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Track meaningful platform product events with privacy data minimization
 */
export async function trackPlatformEvent(params: TrackEventParams): Promise<void> {
  try {
    const resType = params.resourceType || params.entityType || null;
    const resId = params.resourceId || params.entityId || null;
    const meta = params.metadata || params.details || {};

    await query(
      `INSERT INTO platform_events (event_type, user_id, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.eventType,
        params.userId || null,
        resType,
        resId,
        JSON.stringify(meta),
        params.ipAddress || null,
      ]
    );
  } catch (err) {
    // Non-blocking logging failure
    console.error("[Events] Failed to record platform event:", err);
  }
}
