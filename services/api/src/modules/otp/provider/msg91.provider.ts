/**
 * MSG91 OTP Provider (Staging & External Gateway)
 * Implements SMS OTP delivery and verification via MSG91 API v5.
 * Uses backend-only credentials; never exposes auth keys to frontend or logs.
 */

import { IOTPProvider, SendOtpOptions, SendOtpResult, VerifyOtpOptions, VerifyOtpResult } from "../types";
import { env } from "../../../config";

export class MSG91OTPProvider implements IOTPProvider {
  public readonly providerName = "msg91" as const;

  private authKey: string | undefined;
  private templateId: string | undefined;
  private senderId: string | undefined;
  private apiUrl: string;

  constructor() {
    this.authKey = env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY;
    this.templateId = env.MSG91_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID;
    this.senderId = env.MSG91_SENDER_ID || process.env.MSG91_SENDER_ID;
    this.apiUrl = env.MSG91_API_URL || process.env.MSG91_API_URL || "https://control.msg91.com/api/v5/otp";
  }

  /**
   * Send OTP via MSG91 Send OTP endpoint
   */
  public async sendOtp(options: SendOtpOptions): Promise<SendOtpResult> {
    if (!this.authKey || !this.templateId) {
      return {
        success: false,
        provider: "msg91",
        error: "MSG91 credentials not configured (MSG91_AUTH_KEY or MSG91_TEMPLATE_ID missing).",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // MSG91 expects mobile in international format without '+' or with country code
      const formattedMobile = options.phone.replace(/^\+/, "");
      
      const payload: Record<string, any> = {
        template_id: options.templateId || this.templateId,
        mobile: formattedMobile,
        otp: options.otp,
      };

      if (this.senderId) {
        payload.sender = this.senderId;
      }

      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: this.authKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = (await res.json().catch(() => null)) as any;

      if (!res.ok || responseData?.type === "error") {
        const errorMsg = responseData?.message || `MSG91 gateway responded with HTTP ${res.status}`;
        return {
          success: false,
          provider: "msg91",
          error: errorMsg,
        };
      }

      return {
        success: true,
        messageId: responseData?.request_id || responseData?.message || "msg91_sent",
        provider: "msg91",
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      return {
        success: false,
        provider: "msg91",
        error: isTimeout ? "MSG91 gateway request timed out (8s limit)." : "MSG91 network dispatch failure.",
      };
    }
  }

  /**
   * Verify OTP via MSG91 Verify OTP endpoint
   */
  public async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    if (!this.authKey) {
      return {
        success: false,
        error: "MSG91 credentials not configured.",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const formattedMobile = options.phone.replace(/^\+/, "");
      const verifyUrl = new URL(`${this.apiUrl}/verify`);
      verifyUrl.searchParams.append("mobile", formattedMobile);
      verifyUrl.searchParams.append("otp", options.otp);

      const res = await fetch(verifyUrl.toString(), {
        method: "GET",
        headers: {
          authkey: this.authKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = (await res.json().catch(() => null)) as any;

      if (!res.ok || responseData?.type === "error") {
        return {
          success: false,
          error: responseData?.message || "Invalid or expired OTP according to MSG91 gateway.",
        };
      }

      return {
        success: true,
        message: "MSG91 OTP verified successfully.",
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      return {
        success: false,
        error: isTimeout ? "MSG91 verification timed out." : "MSG91 verification network failure.",
      };
    }
  }
}

export const msg91OtpProvider = new MSG91OTPProvider();
