import { BonumError } from "./errors.js";
import type {
  AuthTokenResponseWire,
  BonumGatewayConfig,
  CreateInvoiceInput,
  CreateInvoiceRequestWire,
  CreateQrInput,
  CreateQrRequestWire,
  InvoiceResponse,
  InvoiceResponseWire,
  PayQrInput,
  PaymentPlan,
  PaymentPlanWire,
  PaymentProvider,
  PurchaseInput,
  PurchaseRequestWire,
  PurchaseResponse,
  QrResponse,
  QrResponseWire,
  RequestCardTokenInput,
  RequestCardTokenRequestWire,
  RequestCardTokenResponse,
  RequestCardTokenResponseWire,
  SubscribeInput,
  SubscribeRequestWire,
} from "./gateway-types.js";

const TOKEN_MARGIN_MS = 60_000;

/** Per-request options for {@link BonumGatewayClient}. */
interface RequestOptions {
  /** Value for the `X-CARD-TOKEN` header. */
  cardToken?: string;
}

interface RawResult {
  status: number;
  ok: boolean;
  body: unknown;
}

/**
 * Bonum Gateway Merchant API client.
 *
 * Covers the full gateway surface: Bearer-token authentication (with automatic
 * refresh), web-payment invoices, card tokenization, subscriptions and
 * QR/deeplink payments. For Apple Pay / Google Pay PSP processing use the
 * separate {@link BonumClient}.
 *
 * @example
 * ```ts
 * import { BonumGatewayClient } from "@mongolian-payment/bonum";
 *
 * const client = new BonumGatewayClient({
 *   baseUrl: "https://testapi.bonum.mn",
 *   appSecret: process.env.BONUM_APP_SECRET!,
 *   terminalId: process.env.BONUM_TERMINAL_ID!,
 * });
 *
 * const invoice = await client.createInvoice({
 *   amount: 1000,
 *   callback: "https://your-domain.com/webhook",
 *   transactionId: "ORDER-123",
 * });
 * // redirect the payer to invoice.followUpLink
 * ```
 */
export class BonumGatewayClient {
  private readonly baseUrl: string;
  private readonly config: BonumGatewayConfig;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt = 0;
  private refreshExpiresAt = 0;

  constructor(config: BonumGatewayConfig) {
    if (!config.baseUrl) throw new Error("BonumGatewayClient: baseUrl is required");
    if (!config.appSecret) throw new Error("BonumGatewayClient: appSecret is required");
    if (!config.terminalId) throw new Error("BonumGatewayClient: terminalId is required");

    this.config = config;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  // ==========================================================================
  // Authentication (private)
  // ==========================================================================

  private async auth(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }
    if (this.refreshToken && now < this.refreshExpiresAt) {
      return this.refresh();
    }
    return this.login();
  }

  /** Obtain a fresh token pair via `GET /auth/create`. */
  private async login(): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/bonum-gateway/ecommerce/auth/create`,
      {
        method: "GET",
        headers: {
          Authorization: `AppSecret ${this.config.appSecret}`,
          "X-TERMINAL-ID": this.config.terminalId,
        },
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BonumError(
        `Bonum Gateway auth failed (${res.status})`,
        res.status,
        body,
      );
    }

    const data = (await res.json()) as AuthTokenResponseWire;
    this.setTokens(data);
    return this.accessToken!;
  }

  /** Refresh the access token via `GET /auth/refresh`; fall back to login. */
  private async refresh(): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/bonum-gateway/ecommerce/auth/refresh`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${this.refreshToken}` },
      },
    );

    if (!res.ok) {
      return this.login();
    }

    const data = (await res.json()) as AuthTokenResponseWire;
    this.setTokens(data);
    return this.accessToken!;
  }

  private setTokens(data: AuthTokenResponseWire): void {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    const now = Date.now();
    this.tokenExpiresAt = now + data.expiresIn * 1000 - TOKEN_MARGIN_MS;
    this.refreshExpiresAt = now + data.refreshExpiresIn * 1000 - TOKEN_MARGIN_MS;
  }

  // ==========================================================================
  // HTTP helpers (private)
  // ==========================================================================

  /** Send an authenticated request and return the raw status + parsed body. */
  private async send(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<RawResult> {
    const token = await this.auth();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Accept-Language": this.config.acceptLanguage ?? "mn",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (options.cardToken) headers["X-CARD-TOKEN"] = options.cardToken;

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, init);

    let parsed: unknown = undefined;
    if (res.status !== 204) {
      const contentType = res.headers.get("content-type") ?? "";
      parsed = contentType.includes("application/json")
        ? await res.json().catch(() => undefined)
        : await res.text();
    }

    return { status: res.status, ok: res.ok, body: parsed };
  }

  /** Send a request, throwing {@link BonumError} on a non-2xx response. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const res = await this.send(method, path, body, options);
    if (!res.ok) {
      throw new BonumError(
        `Bonum Gateway error: ${method} ${path} (${res.status})`,
        res.status,
        res.body,
      );
    }
    return res.body as T;
  }

  // ==========================================================================
  // Web payment / invoices
  // ==========================================================================

  /** List the payment providers available for invoices. */
  async getPaymentProviders(): Promise<PaymentProvider[]> {
    return this.request<PaymentProvider[]>(
      "GET",
      "/bonum-gateway/ecommerce/invoices/payment-providers",
    );
  }

  /** Create a web-payment invoice and get the redirect link. */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceResponse> {
    const wire: CreateInvoiceRequestWire = {
      amount: input.amount,
      callback: input.callback,
      transactionId: input.transactionId,
    };
    if (input.expiresIn !== undefined) wire.expiresIn = input.expiresIn;
    if (input.providers) wire.providers = input.providers as string[];
    if (input.items) wire.items = input.items;
    if (input.extras) wire.extras = input.extras;

    const res = await this.request<InvoiceResponseWire>(
      "POST",
      "/bonum-gateway/ecommerce/invoices",
      wire,
    );
    return { invoiceId: res.invoiceId, followUpLink: res.followUpLink };
  }

  /** Get an invoice by ID (test environment helper). */
  async getInvoice(invoiceId: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/bonum-gateway/ecommerce/invoices/${encodeURIComponent(invoiceId)}`,
    );
  }

  // ==========================================================================
  // Card tokenization
  // ==========================================================================

  /** Request a card tokenization; redirect the payer to the returned link. */
  async requestCardToken(
    input: RequestCardTokenInput,
  ): Promise<RequestCardTokenResponse> {
    const wire: RequestCardTokenRequestWire = {
      callback: input.callback,
      transactionId: input.transactionId,
    };
    if (input.payment) wire.payment = input.payment;
    if (input.subscription) wire.subscription = input.subscription;
    if (input.items) wire.items = input.items;

    const res = await this.request<RequestCardTokenResponseWire>(
      "POST",
      "/mpay-service/merchant/cards/tokenize/request",
      wire,
    );
    return { followUpLink: res.followUpLink, id: res.id };
  }

  /**
   * Charge a stored card token.
   *
   * Does not throw on a declined card (HTTP 400) — inspect
   * {@link PurchaseResponse.httpStatus} (200 = success, 201 = queued, 400 =
   * declined). Authentication / server errors still throw {@link BonumError}.
   */
  async purchaseWithCardToken(input: PurchaseInput): Promise<PurchaseResponse> {
    const wire: PurchaseRequestWire = {
      amount: input.amount,
      currency: input.currency ?? "MNT",
      transactionId: input.transactionId,
    };

    const res = await this.send(
      "POST",
      "/mpay-service/merchant/transaction/purchase",
      wire,
      { cardToken: input.cardToken },
    );

    // 401 / 5xx are genuine errors; 200/201/400 are business outcomes.
    if (res.status === 401 || res.status >= 500) {
      throw new BonumError(
        `Bonum Gateway error: POST /mpay-service/merchant/transaction/purchase (${res.status})`,
        res.status,
        res.body,
      );
    }

    const errorCode =
      res.body && typeof res.body === "object"
        ? (res.body as Record<string, unknown>).errorCode
        : undefined;

    return {
      httpStatus: res.status,
      errorCode: typeof errorCode === "string" ? errorCode : undefined,
      raw: res.body,
    };
  }

  /** Roll back (refund) a completed purchase by its transaction ID. */
  async rollbackTransaction(cardToken: string, id: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      `/mpay-service/merchant/transaction/rollback/${encodeURIComponent(id)}`,
      undefined,
      { cardToken },
    );
  }

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  /** List the merchant's active payment plans. */
  async listPaymentPlans(): Promise<PaymentPlan[]> {
    const res = await this.request<{ data: PaymentPlanWire[] }>(
      "GET",
      "/mpay-service/merchant/values/payment-plans",
    );
    return (res.data ?? []).map((p) => ({
      planId: p.planId,
      name: p.name,
      recurringType: p.recurringType,
      amount: p.amount,
      status: p.status,
      retryCount: p.retryCount,
    }));
  }

  /** Subscribe a stored card token to a payment plan. */
  async subscribe(input: SubscribeInput): Promise<unknown> {
    const wire: SubscribeRequestWire = {
      planId: input.planId,
      cycleValue: input.cycleValue,
    };
    if (input.cycles !== undefined) wire.cycles = input.cycles;
    if (input.payNow !== undefined) wire.payNow = input.payNow;
    if (input.custEmail !== undefined) wire.custEmail = input.custEmail;

    return this.request<unknown>(
      "POST",
      "/mpay-service/merchant/subscriptions/subscribe",
      wire,
      { cardToken: input.cardToken },
    );
  }

  /** List the subscriptions attached to a card token. */
  async listSubscriptions(cardToken: string): Promise<unknown> {
    return this.request<unknown>(
      "GET",
      "/mpay-service/merchant/subscriptions",
      undefined,
      { cardToken },
    );
  }

  /** Change a subscription to a different (existing) card token. */
  async changeSubscriptionToken(
    subscriptionId: number | string,
    cardToken: string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/mpay-service/merchant/subscriptions/${encodeURIComponent(String(subscriptionId))}/change`,
      undefined,
      { cardToken },
    );
  }

  /** Start linking a brand-new card token to a subscription. */
  async changeSubscriptionWithNewToken(
    subscriptionId: number | string,
  ): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      `/mpay-service/merchant/subscriptions/${encodeURIComponent(String(subscriptionId))}/change/create-new-token`,
    );
  }

  /** Cancel a subscription (stays active until the next cycle). */
  async cancelSubscription(subscriptionId: number | string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/mpay-service/merchant/subscriptions/${encodeURIComponent(String(subscriptionId))}`,
    );
  }

  /** Permanently delete a subscription (no further charges). */
  async deleteSubscription(subscriptionId: number | string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/mpay-service/merchant/subscriptions/${encodeURIComponent(String(subscriptionId))}/delete`,
    );
  }

  // ==========================================================================
  // QR / deeplink
  // ==========================================================================

  /** Create a QPay QR payment with bank deeplinks. */
  async createQr(input: CreateQrInput): Promise<QrResponse> {
    const wire: CreateQrRequestWire = {
      amount: input.amount,
      transactionId: input.transactionId,
    };
    if (input.expiresIn !== undefined) wire.expiresIn = input.expiresIn;

    const res = await this.request<QrResponseWire>(
      "POST",
      "/mpay-service/merchant/transaction/qr/create",
      wire,
    );
    const data = res.data;
    return {
      invoiceId: data.invoiceId,
      qrCode: data.qrCode,
      qrImage: data.qrImage,
      links: (data.links ?? []).map((l) => ({
        name: l.name,
        link: l.link,
        logo: l.logo,
        appStoreId: l.appStoreId,
        androidPackageName: l.androidPackageName,
      })),
    };
  }

  /** Pay a scanned QPay QR using a stored card token. */
  async payQr(input: PayQrInput): Promise<unknown> {
    return this.request<unknown>(
      "PUT",
      "/merchant/transaction/qr/pay",
      { qrCode: input.qrCode, transactionId: input.transactionId },
      { cardToken: input.cardToken },
    );
  }
}
