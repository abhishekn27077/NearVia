/**
 * OTP Domain & Provider Types
 * Defines interfaces for SMS / OTP providers and domain operations.
 */

export interface SendOtpOptions {
  phone: string;
  otp: string;
  userId?: string;
  templateId?: string;
}

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  provider: "mock" | "msg91";
  error?: string;
}

export interface VerifyOtpOptions {
  phone: string;
  otp: string;
  providerReference?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface IOTPProvider {
  readonly providerName: "mock" | "msg91";
  sendOtp(options: SendOtpOptions): Promise<SendOtpResult>;
  verifyOtp?(options: VerifyOtpOptions): Promise<VerifyOtpResult>;
}

export interface OtpChallengeRow {
  id: string;
  user_id: string;
  phone: string;
  otp_hash: string;
  provider: string;
  provider_reference: string | null;
  attempts: number;
  max_attempts: number;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_at: Date | string;
}
