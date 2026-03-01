import type {
  BonumConfig,
  ProcessPaymentInput,
  ProcessGooglePayInput,
  MerchantValidateInput,
  PaymentProcessResponse,
  PaymentLogEntry,
  PaymentProcessRequestWire,
  GooglePayProcessRequestWire,
  PaymentProcessResponseWire,
  MerchantValidateRequestWire,
  PaymentLogEntryWire,
} from "./types.js";
import { BonumError } from "./errors.js";

/**
 * Bonum PSP API client.
 *
 * Handles card payment processing via Apple Pay, Google Pay, and direct tokens.
 *
 * @example
 * ```ts
 * import { BonumClient } from "@mongolian-payment/bonum";
 *
 * const client = new BonumClient({
 *   endpoint: "https://psp.bonum.mn",
 *   merchantKey: "your-merchant-key",
 * });
 *
 * // Process a payment
 * const result = await client.processPayment({
 *   token: "payment-token-from-authorization",
 *   orderId: "ORDER-001",
 * });
 *
 * // Check payment log
 * const logs = await client.getPaymentLog("ORDER-001");
 * ```
 */
export class BonumClient {
  private readonly config: BonumConfig;

  constructor(config: BonumConfig) {
    this.config = config;
  }

  // ==========================================================================
  // HTTP helper
  // ==========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-merchant-key": this.config.merchantKey,
    };

    const options: RequestInit = { method, headers };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const url = `${this.config.endpoint}${path}`;
    const res = await fetch(url, options);

    let responseBody: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      responseBody = await res.json();
    } else {
      responseBody = await res.text();
    }

    if (!res.ok) {
      throw new BonumError(
        `Bonum API error: ${method} ${path} (${res.status})`,
        res.status,
        responseBody,
      );
    }

    return responseBody as T;
  }

  // ==========================================================================
  // Payment Processing
  // ==========================================================================

  /**
   * Process a payment using a payment token (Apple Pay or card token).
   *
   * @param input - Payment token and order ID
   * @returns Payment processing result
   */
  async processPayment(input: ProcessPaymentInput): Promise<PaymentProcessResponse> {
    const wireBody: PaymentProcessRequestWire = {
      token: input.token,
      orderId: input.orderId,
    };

    const wire = await this.request<PaymentProcessResponseWire>(
      "POST",
      "/api/payment/process",
      wireBody,
    );

    return this.mapPaymentResponse(wire);
  }

  /**
   * Process a Google Pay payment.
   *
   * @param input - Google Pay token, order ID, amount, and currency
   * @returns Payment processing result
   */
  async processGooglePay(input: ProcessGooglePayInput): Promise<PaymentProcessResponse> {
    const wireBody: GooglePayProcessRequestWire = {
      token: input.token,
      order_id: input.orderId,
      amount: String(input.amount),
      currency_code: input.currencyCode,
    };

    const wire = await this.request<PaymentProcessResponseWire>(
      "POST",
      "/api/payment/process/google",
      wireBody,
    );

    return this.mapPaymentResponse(wire);
  }

  // ==========================================================================
  // Merchant Validation
  // ==========================================================================

  /**
   * Validate merchant session for Apple Pay.
   *
   * @param input - Apple Pay validation URL
   * @returns Merchant session object
   */
  async validateMerchant(input: MerchantValidateInput): Promise<unknown> {
    const wireBody: MerchantValidateRequestWire = {
      validationURL: input.validationURL,
    };

    return this.request<unknown>(
      "POST",
      "/api/merchant/validate",
      wireBody,
    );
  }

  // ==========================================================================
  // Payment Log
  // ==========================================================================

  /**
   * Get payment log entries for an order.
   *
   * @param orderId - The order ID to look up
   * @returns Array of payment log entries
   */
  async getPaymentLog(orderId: string): Promise<PaymentLogEntry[]> {
    const wire = await this.request<PaymentLogEntryWire[]>(
      "GET",
      `/api/payment-log/read?order_id=${encodeURIComponent(orderId)}`,
    );

    return wire.map((entry) => this.mapPaymentLogEntry(entry));
  }

  // ==========================================================================
  // Wire → SDK type mappers
  // ==========================================================================

  private mapPaymentResponse(wire: PaymentProcessResponseWire): PaymentProcessResponse {
    return {
      success: wire.success,
      statusCode: wire.status_code,
      orderId: wire.orderId,
      desc: wire.desc,
    };
  }

  private mapPaymentLogEntry(wire: PaymentLogEntryWire): PaymentLogEntry {
    return {
      merchantOrderId: wire.merchant_order_id,
      amount: wire.amount,
      success: wire.success,
      createdAt: wire.createdAt,
    };
  }
}
