/**
 * Mock OTP Provider
 * Used for local development, CI/automated testing, and offline demos.
 * Generates deterministic or pseudo-random verification codes without network dependency.
 */

import { IOTPProvider, SendOtpOptions, SendOtpResult, VerifyOtpOptions, VerifyOtpResult } from "../types";
import { NEARVIA_CONFIG } from "@nearvia/config";

export class MockOTPProvider implements IOTPProvider {
  public readonly providerName = "mock" as const;

  /**
   * Simulate sending OTP via SMS
   */
  public async sendOtp(options: SendOtpOptions): Promise<SendOtpResult> {
    // In mock mode, we generate a synthetic message ID.
    // We NEVER log the OTP in production.
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && process.env.DEBUG_MOCK_OTP === "true") {
      // Safe development debug trace only if explicitly enabled
      console.log(`[MockOTP] Simulated SMS sent to ${options.phone.slice(0, 6)}****`);
    }

    return {
      success: true,
      messageId: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      provider: "mock",
    };
  }

  /**
   * Verify OTP in mock environment
   */
  public async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    const isExpectedCode = options.otp === NEARVIA_CONFIG.OTP.MOCK_OTP_CODE;
    if (isExpectedCode) {
      return {
        success: true,
        message: "Mock verification successful",
      };
    }

    return {
      success: false,
      error: "Invalid mock verification code",
    };
  }
}

export const mockOtpProvider = new MockOTPProvider();
