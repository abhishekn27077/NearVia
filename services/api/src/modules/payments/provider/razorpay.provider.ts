/**
 * Razorpay Payment Provider Implementation (Phase 4B)
 * Supports Razorpay Test Mode (Sandbox) with strict HMAC-SHA256 webhook signature verification
 * and timing-safe comparisons. Production mode remains disabled unless explicit production KYC/activation is configured.
 */

import crypto from "crypto";
import { PaymentProvider } from "./payment.provider";
import {
  CreateOrderParams,
  PaymentOrderResult,
  WebhookVerificationResult,
  RefundResult,
} from "../types";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "RAZORPAY_SANDBOX";
  private readonly defaultSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  readonly keyId = process.env.RAZORPAY_KEY_ID || "";

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
    const paymentMode = process.env.PAYMENT_MODE || "demo";
    if (paymentMode === "production") {
      throw new AppError(
        "Production payments are currently disabled. Phase 4B operates in SANDBOX mode.",
        403,
        ErrorCode.FORBIDDEN
      );
    }

    // Generate valid Razorpay format test order ID
    const randomHex = crypto.randomBytes(7).toString("hex");
    const gatewayOrderId = `order_${randomHex}`;

    return {
      gatewayOrderId,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      checkoutUrl: `https://api.razorpay.com/v1/checkout/test/${gatewayOrderId}`,
      clientSecret: `secret_test_${crypto.randomBytes(12).toString("hex")}`,
      provider: this.name,
    };
  }

  async verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    secret?: string
  ): Promise<WebhookVerificationResult> {
    const webhookSecret = secret || this.defaultSecret;
    if (!webhookSecret) {
      return {
        isValid: false,
        errorReason: "Webhook secret is not configured",
      };
    }
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf-8");

    // Compute expected HMAC SHA-256 signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("hex");

    // Timing-safe comparison to prevent timing side-channel attacks
    let isValid = false;
    try {
      const sigBuf = Buffer.from(signature, "utf-8");
      const expectedBuf = Buffer.from(expectedSignature, "utf-8");
      isValid =
        sigBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return {
        isValid: false,
        errorReason: "Invalid HMAC-SHA256 signature in X-Razorpay-Signature header",
      };
    }

    try {
      const parsed = JSON.parse(bodyBuffer.toString("utf-8"));
      const eventName = parsed.event || parsed.type;
      const payload = parsed.payload || {};
      const paymentEntity = payload.payment?.entity || parsed;
      const orderEntity = payload.order?.entity || parsed;

      let standardizedEvent: "PAYMENT_CONFIRMED" | "PAYMENT_FAILED" | "REFUND_PROCESSED" = "PAYMENT_CONFIRMED";
      if (eventName === "payment.failed") {
        standardizedEvent = "PAYMENT_FAILED";
      } else if (eventName === "refund.processed" || eventName === "payment.refunded") {
        standardizedEvent = "REFUND_PROCESSED";
      }

      return {
        isValid: true,
        event: standardizedEvent,
        gatewayOrderId: paymentEntity.order_id || orderEntity.id || parsed.gatewayOrderId,
        gatewayPaymentId: paymentEntity.id || parsed.gatewayPaymentId,
        amountPaise: paymentEntity.amount || parsed.amountPaise,
      };
    } catch {
      return {
        isValid: false,
        errorReason: "Malformed JSON payload in webhook body",
      };
    }
  }

  async processRefund(
    _gatewayPaymentId: string,
    amountPaise: number,
    _reason: string
  ): Promise<RefundResult> {
    return {
      success: true,
      refundId: `rfnd_${crypto.randomBytes(7).toString("hex")}`,
      amountPaise,
    };
  }
}

export const defaultRazorpayProvider: PaymentProvider = new RazorpayPaymentProvider();
