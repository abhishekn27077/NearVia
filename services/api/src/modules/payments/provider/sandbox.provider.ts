/**
 * Sandbox Payment Provider Implementation (Phase 14)
 * Provides cryptographically secure development & test simulation of India payment gateways (UPI, Netbanking, Cards).
 */

import crypto from "crypto";
import { PaymentProvider } from "./payment.provider";
import {
  CreateOrderParams,
  PaymentOrderResult,
  WebhookVerificationResult,
  RefundResult,
} from "../types";

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "SANDBOX_UPI";
  private readonly defaultSecret = "nearvia_sandbox_webhook_secret_key_2026";

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
    const gatewayOrderId = `order_sb_${crypto.randomBytes(8).toString("hex")}`;

    return {
      gatewayOrderId,
      amountPaise: params.amountPaise,
      currency: params.currency || "INR",
      checkoutUrl: `https://sandbox.nearvia.in/pay/${gatewayOrderId}`,
      clientSecret: `secret_sb_${crypto.randomBytes(12).toString("hex")}`,
      provider: this.name,
    };
  }

  async verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    secret?: string
  ): Promise<WebhookVerificationResult> {
    const webhookSecret = secret || this.defaultSecret;
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");

    // Compute expected HMAC SHA-256 signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyStr)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const isValid =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, "utf-8"),
        Buffer.from(expectedSignature, "utf-8")
      );

    if (!isValid) {
      return {
        isValid: false,
        errorReason: "Invalid HMAC-SHA256 signature",
      };
    }

    try {
      const parsed = JSON.parse(bodyStr);
      const payload = parsed.payload || {};
      const paymentEntity = payload.payment?.entity || parsed;
      const orderEntity = payload.order?.entity || parsed;
      const eventName = parsed.event || parsed.type;

      let standardizedEvent: "PAYMENT_CONFIRMED" | "PAYMENT_FAILED" | "REFUND_PROCESSED" = "PAYMENT_CONFIRMED";
      if (eventName === "payment.failed" || eventName === "PAYMENT_FAILED") {
        standardizedEvent = "PAYMENT_FAILED";
      } else if (eventName === "refund.processed" || eventName === "payment.refunded" || eventName === "REFUND_PROCESSED") {
        standardizedEvent = "REFUND_PROCESSED";
      }

      return {
        isValid: true,
        event: standardizedEvent,
        gatewayOrderId: paymentEntity.order_id || orderEntity.id || parsed.gatewayOrderId || parsed.order_id,
        gatewayPaymentId: paymentEntity.id || parsed.gatewayPaymentId || parsed.payment_id,
        amountPaise: paymentEntity.amount || parsed.amountPaise || parsed.amount,
      };
    } catch {
      return {
        isValid: false,
        errorReason: "Malformed JSON payload",
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
      refundId: `rfnd_sb_${crypto.randomBytes(8).toString("hex")}`,
      amountPaise,
    };
  }
}

export const defaultPaymentProvider: PaymentProvider = new SandboxPaymentProvider();
