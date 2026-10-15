import { query } from "../../db";
import {
  VerificationSubmitInput,
  VerificationRecord,
  KycUploadUrlInput,
} from "./types";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { storageService, KycUploadUrlResult } from "../../services/storage.service";

export class VerificationService {
  /**
   * Request a private signed upload URL for document upload.
   */
  public async createUploadUrl(
    userId: string,
    input: KycUploadUrlInput
  ): Promise<KycUploadUrlResult> {
    // Validate target role
    if (input.targetType === "WORKER") {
      const w = await query(`SELECT id FROM worker_profiles WHERE user_id = $1`, [userId]);
      if (w.rowCount === 0) throw new AppError("No worker profile found", 400);
    } else if (input.targetType === "PROVIDER" || input.targetType === "BUSINESS") {
      const p = await query(`SELECT id FROM provider_profiles WHERE user_id = $1`, [userId]);
      if (p.rowCount === 0) throw new AppError("No provider profile found", 400);
    }

    const fileSizeBytes = input.fileSizeBytes ?? input.fileSize ?? 0;
    return await storageService.createKycUploadUrl(userId, input.fileType, input.fileName, fileSizeBytes);
  }

  /**
   * Submit a new verification request or resubmit an existing flagged request.
   */
  public async submitVerification(
    userId: string,
    data: VerificationSubmitInput
  ): Promise<VerificationRecord> {
    // Enforce document ownership: reject supplied storage path unless scoped to the authenticated user
    if (data.storagePath) {
      const userPrefix = `kyc/${userId}/`;
      if (!data.storagePath.startsWith(userPrefix) || data.storagePath.includes("..")) {
        throw new AppError(
          "Invalid document storage path: path must be scoped to authenticated user.",
          400,
          ErrorCode.VALIDATION_ERROR
        );
      }
    }

    if (data.documentRef && data.documentRef.startsWith("kyc/")) {
      const userPrefix = `kyc/${userId}/`;
      if (!data.documentRef.startsWith(userPrefix) || data.documentRef.includes("..")) {
        throw new AppError(
          "Invalid document storage path: path must be scoped to authenticated user.",
          400,
          ErrorCode.VALIDATION_ERROR
        );
      }
    }

    // Ensure the user actually has the profile they are trying to verify
    if (data.targetType === "WORKER") {
      const w = await query(`SELECT id FROM worker_profiles WHERE user_id = $1`, [userId]);
      if (w.rowCount === 0) throw new AppError("No worker profile found", 400);
    } else if (data.targetType === "PROVIDER" || data.targetType === "BUSINESS") {
      const p = await query(`SELECT id FROM provider_profiles WHERE user_id = $1`, [userId]);
      if (p.rowCount === 0) throw new AppError("No provider profile found", 400);
    }

    // Check for existing pending or resubmission-required request
    const existing = await query(
      `SELECT id, status FROM verifications
       WHERE target_id = $1 AND target_type = $2 AND verification_type = $3
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [userId, data.targetType, data.verificationType]
    );

    const existingRow = existing.rows[0];

    if (existingRow && existingRow.status === "PENDING") {
      throw new AppError("A verification request of this type is already pending review", 400);
    }

    // Check if storage_path column exists in the database
    const colCheck = await query<{ count: string }>(
      `SELECT COUNT(*) FROM information_schema.columns
       WHERE table_name = 'verifications' AND column_name = 'storage_path'`
    );
    const hasStoragePathCol = parseInt(colCheck.rows[0]?.count || "0", 10) > 0;

    const docRef = data.storagePath || data.documentRef || "PENDING_STORAGE";

    // If previously marked RESUBMISSION_REQUIRED, transition back to PENDING with updated document
    if (existingRow && existingRow.status === "RESUBMISSION_REQUIRED") {
      let updateSql: string;
      let params: any[];

      if (hasStoragePathCol) {
        updateSql = `
          UPDATE verifications
          SET status = 'PENDING',
              document_ref = $1,
              storage_path = $2,
              submitted_at = NOW(),
              rejection_reason = NULL,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *`;
        params = [docRef, data.storagePath || null, existingRow.id];
      } else {
        updateSql = `
          UPDATE verifications
          SET status = 'PENDING',
              document_ref = $1,
              submitted_at = NOW(),
              rejection_reason = NULL,
              updated_at = NOW()
          WHERE id = $2
          RETURNING *`;
        params = [docRef, existingRow.id];
      }

      const res = await query(updateSql, params);
      const row = res.rows[0];
      if (!row) throw new AppError("Failed to update verification request", 500);

      return {
        id: row.id,
        targetType: row.target_type,
        targetId: row.target_id,
        verificationType: row.verification_type,
        documentRef: row.document_ref,
        storagePath: row.storage_path,
        status: row.status,
        submittedAt: row.submitted_at,
      };
    }

    // Insert brand-new verification submission
    let insertSql: string;
    let params: any[];

    if (hasStoragePathCol) {
      insertSql = `
        INSERT INTO verifications (target_type, target_id, verification_type, document_ref, storage_path, status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING *`;
      params = [data.targetType, userId, data.verificationType, docRef, data.storagePath || null];
    } else {
      insertSql = `
        INSERT INTO verifications (target_type, target_id, verification_type, document_ref, status)
        VALUES ($1, $2, $3, $4, 'PENDING')
        RETURNING *`;
      params = [data.targetType, userId, data.verificationType, docRef];
    }

    const res = await query(insertSql, params);
    const row = res.rows[0];
    if (!row) throw new AppError("Failed to submit verification request", 500);

    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      verificationType: row.verification_type,
      documentRef: row.document_ref,
      storagePath: row.storage_path,
      status: row.status,
      submittedAt: row.submitted_at,
    };
  }

  /**
   * Get all verifications for the current user
   */
  public async getMyVerifications(userId: string): Promise<VerificationRecord[]> {
    const res = await query(
      `SELECT id, target_type, target_id, verification_type, document_ref, status, submitted_at, reviewed_at, reviewed_by, rejection_reason
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
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
      rejectionReason: row.rejection_reason,
    }));
  }
}

export const verificationService = new VerificationService();
