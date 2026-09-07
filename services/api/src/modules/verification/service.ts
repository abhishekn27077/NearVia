import { query } from "../../db";
import { VerificationSubmitInput, VerificationRecord } from "./types";
import { AppError } from "../../middleware/errorHandler";

export class VerificationService {
  /**
   * Submit a new verification request.
   */
  public async submitVerification(
    userId: string,
    data: VerificationSubmitInput
  ): Promise<VerificationRecord> {
    
    // For MVP, we use the user's ID as the target ID for workers and providers.
    // Ensure the user actually has the profile they are trying to verify.
    if (data.targetType === "WORKER") {
      const w = await query(`SELECT id FROM worker_profiles WHERE user_id = $1`, [userId]);
      if (w.rowCount === 0) throw new AppError("No worker profile found", 400);
    } else if (data.targetType === "PROVIDER" || data.targetType === "BUSINESS") {
      const p = await query(`SELECT id FROM provider_profiles WHERE user_id = $1`, [userId]);
      if (p.rowCount === 0) throw new AppError("No provider profile found", 400);
    }
    
    // Prevent duplicate pending requests for the same target/type
    const existing = await query(
      `SELECT id FROM verifications 
       WHERE target_id = $1 AND target_type = $2 AND verification_type = $3 AND status = 'PENDING'`,
      [userId, data.targetType, data.verificationType]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new AppError("A verification request of this type is already pending", 400);
    }

    const res = await query(
      `INSERT INTO verifications (target_type, target_id, verification_type, document_ref, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [data.targetType, userId, data.verificationType, data.documentRef]
    );

    const row = res.rows[0];
    if (!row) throw new AppError("Failed to submit verification", 500);

    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      verificationType: row.verification_type,
      documentRef: row.document_ref,
      status: row.status,
      submittedAt: row.submitted_at,
    };
  }

  /**
   * Get all verifications for the current user
   */
  public async getMyVerifications(userId: string): Promise<VerificationRecord[]> {
    const res = await query(
      `SELECT id, target_type, target_id, verification_type, document_ref, status, submitted_at, rejection_reason
       FROM verifications
       WHERE target_id = $1
       ORDER BY submitted_at DESC`,
      [userId]
    );

    return res.rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      verificationType: row.verification_type,
      documentRef: row.document_ref,
      status: row.status,
      submittedAt: row.submitted_at,
      rejectionReason: row.rejection_reason,
    }));
  }
}

export const verificationService = new VerificationService();
