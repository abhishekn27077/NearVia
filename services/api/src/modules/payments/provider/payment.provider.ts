/**
 * Payment Provider Interface
 * Decouples NEARVIA domain business logic from specific payment gateways.
 */

import {
  CreateOrderParams,
  PaymentOrderResult,
  WebhookVerificationResult,
  RefundResult,
} from "../types";

export interface PaymentProvider {
  readonly name: string;

  /**
   * Creates an order with the gateway
   */
  createOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;

  /**
   * Cryptographically verifies incoming webhook signatures and parses standard event
   */
  verifyWebhook(
    rawBody: string | Buffer,
    signature: string,
    secret?: string
  ): Promise<WebhookVerificationResult>;

  /**
   * Initiates a refund for a previously confirmed payment
   */
  processRefund(
    gatewayPaymentId: string,
    amountPaise: number,
    reason: string
  ): Promise<RefundResult>;
}
