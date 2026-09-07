/**
 * Audit Logging Helper (Phase 15)
 * Immutable Security & Platform Governance Event Trail
 */

import { query } from "../db";

export interface AuditLogParams {
  actorId: string | null;
  action: string;
  targetEntity: string;
  targetId: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (
        actor_id, action, target_entity, target_id, old_values, new_values, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.actorId,
        params.action,
        params.targetEntity,
        params.targetId,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        params.ipAddress || null,
        params.userAgent || null,
      ]
    );
  } catch (error) {
    // Audit log failure should be logged but not crash the parent transaction if standalone
    console.error("[AuditLog Error] Failed to write audit event:", error);
  }
}
