/**
 * OTP Verification Service
 * Handles phone normalization, rate limiting, cooldowns, cryptographic challenge hashing,
 * provider dispatching (Mock / MSG91), audit logging, and trust state transitions.
 */

import crypto from "crypto";
import { query } from "../../db";
import { env } from "../../config";
import { NEARVIA_CONFIG } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { AuthUserContext, UserRole } from "@nearvia/types";
import { IOTPProvider, OtpChallengeRow } from "./types";
import { mockOtpProvider } from "./provider/mock.provider";
import { msg91OtpProvider } from "./provider/msg91.provider";
import { notificationsService } from "../notifications/service";

const OTP_SALT = process.env.OTP_SALT || "nearvia_otp_secure_salt_2026";

export class OTPService {
  private getProvider(): IOTPProvider {
    const providerName = (process.env.OTP_PROVIDER || env.OTP_PROVIDER || "mock").toLowerCase();
    if (providerName === "msg91") {
      return msg91OtpProvider;
    }
    // Hardening: Prevent accidental mock OTP in production environment
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_OTP_IN_PRODUCTION !== "true") {
      throw new AppError(
        "Mock OTP provider is disabled in production. Configure a verified SMS provider (OTP_PROVIDER=msg91).",
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
    return mockOtpProvider;
  }

  /**
   * Standardize phone number into E.164 format (+91XXXXXXXXXX for India)
   */
  public normalizePhone(rawPhone: string): string {
    if (!rawPhone || typeof rawPhone !== "string") {
      throw new AppError("Phone number is required.", 400, ErrorCode.VALIDATION_ERROR);
    }

    const cleaned = rawPhone.replace(/[\s\-\(\)]/g, "");

    // 10 digits starting with 6-9 (Standard Indian Mobile)
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }

    // 12 digits starting with 91
    if (/^91[6-9]\d{9}$/.test(cleaned)) {
      return `+${cleaned}`;
    }

    // Already prefixed with +91
    if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
      return cleaned;
    }

    // General International E.164 (7-15 digits)
    if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      return cleaned;
    }

    throw new AppError(
      "Invalid mobile number format. Please provide a valid 10-digit mobile number or full international format (+91XXXXXXXXXX).",
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  /**
   * Cryptographically hash OTP token with HMAC-SHA256
   */
  public hashOtp(phone: string, otp: string): string {
    return crypto.createHmac("sha256", OTP_SALT).update(`${phone}:${otp}`).digest("hex");
  }

  /**
   * Constant-time timing-safe hash comparison
   */
  public verifyHash(providedOtp: string, phone: string, targetHash: string): boolean {
    const calculatedHash = this.hashOtp(phone, providedOtp);
    if (calculatedHash.length !== targetHash.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHash, "hex"),
      Buffer.from(targetHash, "hex"),
    );
  }

  /**
   * Generate OTP code (Deterministic mock in test/demo mode, secure random in staging/production)
   */
  public generateOtpCode(): string {
    const provider = this.getProvider();
    if (provider.providerName === "mock") {
      return NEARVIA_CONFIG.OTP.MOCK_OTP_CODE;
    }
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Request / Send OTP to user's phone for progressive verification
   */
  public async sendOtp(userId: string, rawPhone: string, ipAddress?: string): Promise<{
    phone: string;
    cooldownSeconds: number;
    expiresInSeconds: number;
    provider: string;
  }> {
    const normalizedPhone = this.normalizePhone(rawPhone);

    // 1. Verify user exists
    const userRes = await query<{ id: string; role: string; email: string }>(
      "SELECT id, role, email FROM users WHERE id = $1",
      [userId],
    );
    if (userRes.rows.length === 0 || !userRes.rows[0]) {
      throw new AppError("User account not found.", 404, ErrorCode.NOT_FOUND);
    }

    // 2. Prevent duplicate verified phone linking across accounts (Safe, non-enumerating error)
    const dupRes = await query<{ id: string }>(
      "SELECT id FROM users WHERE phone = $1 AND mobile_verified = TRUE AND id != $2 LIMIT 1",
      [normalizedPhone, userId],
    );
    if (dupRes.rows.length > 0) {
      throw new AppError(
        "This phone number cannot be linked to this account. Please use a different phone number.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 3. Enforce Rate Limiting & Cooldowns
    const cooldownWindowSec = NEARVIA_CONFIG.OTP.RESEND_COOLDOWN_SECONDS; // 60s
    const rateLimitWindowMin = NEARVIA_CONFIG.OTP.RATE_LIMIT_WINDOW_MINUTES; // 10m
    const maxSendsPerWindow = NEARVIA_CONFIG.OTP.MAX_RESENDS_PER_WINDOW; // 4

    // 3a. Check recent send cooldown
    const recentSendRes = await query<{ created_at: string }>(
      `SELECT created_at FROM otp_challenges 
       WHERE user_id = $1 AND phone = $2 AND created_at > NOW() - INTERVAL '1 second' * $3 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, normalizedPhone, cooldownWindowSec],
    );

    if (recentSendRes.rows.length > 0 && recentSendRes.rows[0]) {
      const elapsedMs = Date.now() - new Date(recentSendRes.rows[0].created_at).getTime();
      const remainingSec = Math.max(1, Math.ceil((cooldownWindowSec * 1000 - elapsedMs) / 1000));
      
      await this.logAudit(userId, "OTP_RATE_LIMITED", userId, {
        phone: normalizedPhone.slice(0, 6) + "****",
        reason: "COOLDOWN_ACTIVE",
        remainingSeconds: remainingSec,
        ipAddress,
      });

      throw new AppError(
        `Please wait ${remainingSec} seconds before requesting another verification code.`,
        429,
        ErrorCode.RATE_LIMITED,
      );
    }

    // 3b. Check total window rate limit
    const windowSendsRes = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM otp_challenges 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [userId, rateLimitWindowMin],
    );

    const totalInWindow = parseInt(windowSendsRes.rows[0]?.count || "0", 10);
    if (totalInWindow >= maxSendsPerWindow) {
      await this.logAudit(userId, "OTP_RATE_LIMITED", userId, {
        phone: normalizedPhone.slice(0, 6) + "****",
        reason: "MAX_SENDS_EXCEEDED",
        windowMinutes: rateLimitWindowMin,
        ipAddress,
      });

      throw new AppError(
        `Too many verification attempts. Please wait ${rateLimitWindowMin} minutes before trying again.`,
        429,
        ErrorCode.RATE_LIMITED,
      );
    }

    // 4. Invalidate all previous unconsumed challenges for this user/phone
    await query(
      `UPDATE otp_challenges SET consumed_at = NOW() 
       WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    );

    // 5. Generate and hash OTP
    const otpCode = this.generateOtpCode();
    const otpHash = this.hashOtp(normalizedPhone, otpCode);
    const provider = this.getProvider();
    const expiryMinutes = NEARVIA_CONFIG.OTP.EXPIRY_MINUTES; // 10 min

    // 6. Record Challenge in Database
    const challengeRes = await query<OtpChallengeRow>(
      `INSERT INTO otp_challenges (
        user_id, phone, otp_hash, provider, max_attempts, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW() + INTERVAL '1 minute' * $6
      ) RETURNING *`,
      [
        userId,
        normalizedPhone,
        otpHash,
        provider.providerName,
        NEARVIA_CONFIG.OTP.MAX_ATTEMPTS,
        expiryMinutes,
      ],
    );

    const challenge = challengeRes.rows[0];
    if (!challenge) {
      throw new AppError("Failed to initialize verification challenge.", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // 7. Dispatch through OTP Provider (Mock or MSG91)
    const sendResult = await provider.sendOtp({
      phone: normalizedPhone,
      otp: otpCode,
      userId,
    });

    if (!sendResult.success) {
      // Invalidate the challenge since dispatch failed
      await query(
        `UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`,
        [challenge.id],
      );

      await this.logAudit(userId, "OTP_FAILED", userId, {
        phone: normalizedPhone.slice(0, 6) + "****",
        provider: provider.providerName,
        error: sendResult.error,
        ipAddress,
      });

      throw new AppError(
        sendResult.error || "Failed to send SMS verification code. Please try again.",
        502,
        ErrorCode.EXTERNAL_GATEWAY_ERROR,
      );
    }

    // 8. Update provider reference if returned
    if (sendResult.messageId) {
      await query(
        `UPDATE otp_challenges SET provider_reference = $1 WHERE id = $2`,
        [sendResult.messageId, challenge.id],
      );
    }

    // 9. Record Security Audit Log (Never log the raw OTP!)
    await this.logAudit(userId, "OTP_REQUESTED", userId, {
      phone: normalizedPhone.slice(0, 6) + "****",
      provider: provider.providerName,
      messageId: sendResult.messageId,
      expiresAt: challenge.expires_at,
      ipAddress,
    });

    return {
      phone: normalizedPhone,
      cooldownSeconds: cooldownWindowSec,
      expiresInSeconds: expiryMinutes * 60,
      provider: provider.providerName,
    };
  }

  /**
   * Verify provided OTP code against active challenge and persist mobile_verified = TRUE
   */
  public async verifyOtp(
    userId: string,
    rawPhone: string,
    otpCode: string,
    ipAddress?: string,
  ): Promise<AuthUserContext> {
    if (!otpCode || typeof otpCode !== "string" || otpCode.trim().length === 0) {
      throw new AppError("Verification code (OTP) is required.", 400, ErrorCode.VALIDATION_ERROR);
    }

    const normalizedPhone = this.normalizePhone(rawPhone);
    const cleanedOtp = otpCode.trim();

    // 1. Fetch latest active challenge for this user & phone
    const challengeRes = await query<OtpChallengeRow>(
      `SELECT * FROM otp_challenges 
       WHERE user_id = $1 AND phone = $2 AND consumed_at IS NULL 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, normalizedPhone],
    );

    const challenge = challengeRes.rows[0];
    if (!challenge) {
      await this.logAudit(userId, "OTP_FAILED", userId, {
        phone: normalizedPhone.slice(0, 6) + "****",
        reason: "NO_ACTIVE_CHALLENGE",
        ipAddress,
      });
      throw new AppError(
        "No active verification request found. Please request a new OTP code.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 2. Check Expiration
    const expiresAt = new Date(challenge.expires_at).getTime();
    if (Date.now() > expiresAt) {
      await query(`UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`, [challenge.id]);
      
      await this.logAudit(userId, "OTP_EXPIRED", userId, {
        challengeId: challenge.id,
        phone: normalizedPhone.slice(0, 6) + "****",
        ipAddress,
      });

      throw new AppError(
        "Verification code has expired. Please request a new OTP.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 3. Check Attempt Limit (Max 3)
    if (challenge.attempts >= challenge.max_attempts) {
      await query(`UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`, [challenge.id]);

      await this.logAudit(userId, "OTP_RATE_LIMITED", userId, {
        challengeId: challenge.id,
        phone: normalizedPhone.slice(0, 6) + "****",
        reason: "MAX_ATTEMPTS_EXCEEDED",
        attempts: challenge.attempts,
        ipAddress,
      });

      throw new AppError(
        "Maximum verification attempts exceeded for this code. Please request a new OTP.",
        429,
        ErrorCode.RATE_LIMITED,
      );
    }

    // 4. Increment Attempt Counter
    await query(
      `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1`,
      [challenge.id],
    );

    // 5. Verify Token Authenticity
    let isValid = false;
    const provider = this.getProvider();

    if (challenge.provider === "msg91" && provider.verifyOtp) {
      const externalVerify = await provider.verifyOtp({
        phone: normalizedPhone,
        otp: cleanedOtp,
        providerReference: challenge.provider_reference || undefined,
      });
      isValid = externalVerify.success;
    } else {
      // Local cryptographic hash check (Mock / Internal)
      isValid = this.verifyHash(cleanedOtp, normalizedPhone, challenge.otp_hash);
    }

    if (!isValid) {
      await this.logAudit(userId, "OTP_FAILED", userId, {
        challengeId: challenge.id,
        phone: normalizedPhone.slice(0, 6) + "****",
        attemptsUsed: challenge.attempts + 1,
        maxAttempts: challenge.max_attempts,
        ipAddress,
      });

      const remaining = challenge.max_attempts - (challenge.attempts + 1);
      throw new AppError(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : "Invalid verification code. Maximum attempts reached. Please request a new code.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 6. Mark Challenge Consumed (Replay Prevention)
    await query(
      `UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`,
      [challenge.id],
    );

    // 7. Update User Record: phone, mobile_verified = TRUE, mobile_verified_at = NOW()
    const updateRes = await query<any>(
      `UPDATE users SET 
        phone = $1, 
        mobile_verified = TRUE, 
        mobile_verified_at = NOW(), 
        updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [normalizedPhone, userId],
    );

    const updatedUserRow = updateRes.rows[0];
    if (!updatedUserRow) {
      throw new AppError("Failed to update user verification status.", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // 8. Record Successful Audit Events
    await this.logAudit(userId, "OTP_VERIFIED", userId, {
      challengeId: challenge.id,
      phone: normalizedPhone.slice(0, 6) + "****",
      provider: challenge.provider,
      ipAddress,
    });

    await this.logAudit(userId, "PHONE_VERIFIED", userId, {
      phone: normalizedPhone.slice(0, 6) + "****",
      verifiedAt: new Date().toISOString(),
      ipAddress,
    });

    // 9. Send In-App Realtime Notification
    await notificationsService.createNotification(
      userId,
      "PHONE_VERIFIED",
      "Mobile Phone Verified ✓",
      `Your phone number (${normalizedPhone}) has been verified. You now have trusted provider/worker badges!`,
      { phone: normalizedPhone, verifiedAt: new Date().toISOString() },
    ).catch(() => {});

    return {
      id: updatedUserRow.id,
      authId: updatedUserRow.auth_id,
      phone: updatedUserRow.phone,
      fullName: updatedUserRow.full_name,
      email: updatedUserRow.email,
      role: updatedUserRow.role as UserRole,
      avatarUrl: updatedUserRow.avatar_url,
      language: updatedUserRow.language || "en",
      locationText: updatedUserRow.location_text,
      latitude: updatedUserRow.latitude ? Number(updatedUserRow.latitude) : undefined,
      longitude: updatedUserRow.longitude ? Number(updatedUserRow.longitude) : undefined,
      mobileVerified: true,
      mobileVerifiedAt: updatedUserRow.mobile_verified_at,
      identityVerified: Boolean(updatedUserRow.identity_verified),
      identityVerifiedAt: updatedUserRow.identity_verified_at,
      profileCompleted: Boolean(updatedUserRow.profile_completed),
      isActive: Boolean(updatedUserRow.is_active),
      createdAt: updatedUserRow.created_at,
      updatedAt: updatedUserRow.updated_at,
    };
  }

  /**
   * Helper to write immutable security audit logs
   */
  private async logAudit(
    actorId: string,
    action: string,
    targetId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs (
          actor_id, action, target_entity, target_id, new_values, ip_address
        ) VALUES ($1, $2, 'OTP_VERIFICATION', $3, $4, $5)`,
        [
          actorId,
          action,
          targetId,
          JSON.stringify(metadata),
          metadata.ipAddress || null,
        ],
      );
    } catch {
      // Audit log failures should not abort main flow
    }
  }
}

export const otpService = new OTPService();
