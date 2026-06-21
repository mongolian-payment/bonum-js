// =============================================================================
// Bonum Gateway API types
//
// These cover the full Bonum Gateway Merchant API (Bearer-token auth, web
// payment / invoices, card tokenization, subscriptions, QR / deeplink and
// webhooks). They are independent of the older PSP/Apple Pay surface in
// `types.ts`.
// =============================================================================

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Bonum Gateway client configuration. */
export interface BonumGatewayConfig {
  /**
   * API base URL.
   * - Test: `https://testapi.bonum.mn`
   * - Production: `https://apis.bonum.mn`
   */
  baseUrl: string;
  /** Merchant secret key (`APP_SECRET`), sent as `Authorization: AppSecret <appSecret>`. */
  appSecret: string;
  /** Terminal ID created in the merchant portal (`X-TERMINAL-ID`). */
  terminalId: string;
  /**
   * Merchant checksum key used to verify incoming webhook signatures.
   * Optional here — only required if you use {@link verifyWebhookChecksum}.
   */
  checksumKey?: string;
  /** Response language for the API (`mn` or `en`). Defaults to `mn`. */
  acceptLanguage?: "mn" | "en";
}

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

/** Wire format for the auth/create and auth/refresh responses. */
export interface AuthTokenResponseWire {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  unit: string;
}

// -----------------------------------------------------------------------------
// Web payment / invoices
// -----------------------------------------------------------------------------

/** Available payment provider for an invoice. */
export type PaymentProvider =
  | "QPAY"
  | "E_COMMERCE"
  | "WE_CHAT"
  | "SONO_SHOP"
  | (string & {});

/** A line item shown on the Bonum payment interface. */
export interface InvoiceItem {
  /** Product image URL. */
  image?: string;
  /** Item title. */
  title: string;
  /** Free-form remark / description. */
  remark?: string;
  /** Item amount (MNT). */
  amount: number;
  /** Quantity. */
  count: number;
}

/** Type of an extra input field requested from the payer. */
export type ExtraInputType = "NUMBER" | "PHONE" | "EMAIL" | "TEXT" | "ALL";

/** An extra input field collected from the payer on the Bonum interface. */
export interface InvoiceExtra {
  /** Placeholder text shown to the payer. */
  placeholder: string;
  /** Input type. */
  type: ExtraInputType;
  /** Whether the field is required. */
  required: boolean;
}

/** Input for creating a web-payment invoice. */
export interface CreateInvoiceInput {
  /** Total payment amount (MNT). */
  amount: number;
  /** Your webhook URL, called after payment. */
  callback: string;
  /** Your system's unique transaction ID. */
  transactionId: string;
  /** Invoice lifetime in seconds. Optional. */
  expiresIn?: number;
  /** Restrict to specific providers. Optional — omit to show all. */
  providers?: PaymentProvider[];
  /** Line items shown on the payment interface. Optional. */
  items?: InvoiceItem[];
  /** Extra input fields collected from the payer. Optional. */
  extras?: InvoiceExtra[];
}

/** Wire format for the create-invoice request body. */
export interface CreateInvoiceRequestWire {
  amount: number;
  callback: string;
  transactionId: string;
  expiresIn?: number;
  providers?: string[];
  items?: InvoiceItem[];
  extras?: InvoiceExtra[];
}

/** Response from creating an invoice. */
export interface InvoiceResponse {
  /** Bonum invoice ID. */
  invoiceId: string;
  /** Link to redirect the payer to in order to complete payment. */
  followUpLink: string;
}

/** Wire format for the create-invoice response. */
export interface InvoiceResponseWire {
  invoiceId: string;
  followUpLink: string;
}

// -----------------------------------------------------------------------------
// Card tokenization
// -----------------------------------------------------------------------------

/** One-off payment to charge when tokenizing a card. */
export interface TokenizePayment {
  /** Amount to charge during tokenization (MNT). */
  amount: number;
}

/** Subscription linkage applied while tokenizing a card. */
export interface TokenizeSubscription {
  /** Payment plan ID to attach. */
  planId: number;
  /** Recurring cycle value (see {@link SubscribeInput.cycleValue}). */
  cycleValue?: string;
  /** Number of cycles. */
  cycles?: number;
  /** Charge the first cycle immediately. */
  payNow?: boolean;
  /** Customer email. */
  custEmail?: string;
}

/** Input for requesting a card tokenization. */
export interface RequestCardTokenInput {
  /** Callback URL invoked after tokenization. */
  callback: string;
  /** Your unique transaction ID. */
  transactionId: string;
  /** Optional one-off payment to run during tokenization. */
  payment?: TokenizePayment;
  /** Optional subscription to attach to the new token. */
  subscription?: TokenizeSubscription;
  /** Optional line items. */
  items?: InvoiceItem[];
}

/** Wire format for the tokenize-request body. */
export interface RequestCardTokenRequestWire {
  callback: string;
  transactionId: string;
  payment?: TokenizePayment;
  subscription?: TokenizeSubscription;
  items?: InvoiceItem[];
}

/** Response from requesting a card tokenization. */
export interface RequestCardTokenResponse {
  /** Link to redirect the payer to in order to enter their card. */
  followUpLink: string;
  /** Tokenization request ID. */
  id: string;
}

/** Wire format for the tokenize-request response. */
export interface RequestCardTokenResponseWire {
  followUpLink: string;
  id: string;
}

/** Input for charging a stored card token. */
export interface PurchaseInput {
  /** The card token (sent as the `X-CARD-TOKEN` header). */
  cardToken: string;
  /** Amount to charge. */
  amount: number;
  /** Currency, e.g. `MNT`. Defaults to `MNT`. */
  currency?: string;
  /** Your unique transaction ID. */
  transactionId: string;
}

/** Wire format for the purchase request body. */
export interface PurchaseRequestWire {
  amount: number;
  currency: string;
  transactionId: string;
}

/** Result of a token purchase. */
export interface PurchaseResponse {
  /** HTTP status returned by the purchase call (200 = success, 201 = queued). */
  httpStatus: number;
  /** Internal Bonum error/status code (SUCCESS | QUEUED | FAILED). Do not show to users. */
  errorCode?: string;
  /** Raw response body. */
  raw: unknown;
}

// -----------------------------------------------------------------------------
// Subscriptions
// -----------------------------------------------------------------------------

/** Recurring frequency of a payment plan. */
export type RecurringType = "WEEKLY" | "MONTHLY" | "YEARLY" | (string & {});

/** A merchant payment plan. */
export interface PaymentPlan {
  /** Plan ID. */
  planId: number;
  /** Display name. */
  name: string;
  /** Recurring frequency. */
  recurringType: RecurringType;
  /** Cycle amount (MNT). */
  amount: number;
  /** Plan status, e.g. `ACTIVE`. */
  status: string;
  /** Retry attempts on failure. */
  retryCount: number;
}

/** Wire format for a payment plan entry. */
export interface PaymentPlanWire {
  planId: number;
  name: string;
  recurringType: string;
  amount: number;
  status: string;
  retryCount: number;
}

/** Input for subscribing a stored card token to a plan. */
export interface SubscribeInput {
  /** The card token (sent as the `X-CARD-TOKEN` header). */
  cardToken: string;
  /** Plan ID to subscribe to. */
  planId: number;
  /**
   * Cycle value, interpreted by the plan's recurring type:
   * - WEEKLY: 1-7 (Mon=1 … Sun=7)
   * - MONTHLY: 1-31 (day of month)
   * - YEARLY: 1-366 (day of year)
   */
  cycleValue: number;
  /** Number of cycles; `null` to continue until cancelled. */
  cycles?: number | null;
  /** Charge the first cycle immediately. */
  payNow?: boolean;
  /** Customer email. */
  custEmail?: string;
}

/** Wire format for the subscribe request body. */
export interface SubscribeRequestWire {
  planId: number;
  cycleValue: number;
  cycles?: number | null;
  payNow?: boolean;
  custEmail?: string;
}

// -----------------------------------------------------------------------------
// QR / deeplink
// -----------------------------------------------------------------------------

/** Input for creating a QR payment. */
export interface CreateQrInput {
  /** Amount (MNT). */
  amount: number;
  /** Your unique transaction ID. */
  transactionId: string;
  /** QR lifetime in seconds. Optional. */
  expiresIn?: number;
}

/** Wire format for the QR-create request body. */
export interface CreateQrRequestWire {
  amount: number;
  transactionId: string;
  expiresIn?: number;
}

/** A bank deeplink for a QR payment. */
export interface QrLink {
  /** Bank/app name. */
  name: string;
  /** Deeplink URL. */
  link: string;
  /** Logo URL. */
  logo?: string;
  /** iOS App Store ID. */
  appStoreId?: string;
  /** Android package name. */
  androidPackageName?: string;
}

/** Response from creating a QR payment. */
export interface QrResponse {
  /** Bonum invoice ID. */
  invoiceId: string;
  /** QR code text. */
  qrCode: string;
  /** Base64-encoded QR image (use directly as `data:image/png;base64,...`). */
  qrImage: string;
  /** Bank deeplinks. */
  links: QrLink[];
}

/** Wire format for the QR-create response (`{ data: { ... } }`). */
export interface QrResponseWire {
  data: {
    invoiceId: string;
    qrCode: string;
    qrImage: string;
    links: Array<{
      name: string;
      link: string;
      logo?: string;
      appStoreId?: string;
      androidPackageName?: string;
    }>;
  };
}

/** Input for paying a scanned QPay QR with a stored card token. */
export interface PayQrInput {
  /** The card token (sent as the `X-CARD-TOKEN` header). */
  cardToken: string;
  /** The scanned QPay QR code string. */
  qrCode: string;
  /** Your unique transaction ID. */
  transactionId: string;
}

// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------

/** Webhook notification type. */
export type WebhookType =
  | "PAYMENT"
  | "CARD-TOKEN"
  | "SUBSCRIPTION-PAYMENT"
  | (string & {});

/** Webhook delivery status. */
export type WebhookStatus = "SUCCESS" | "FAILED" | (string & {});

/** A parsed Bonum webhook event. The `body` shape depends on `type`. */
export interface WebhookEvent<TBody = Record<string, unknown>> {
  /** Event type. */
  type: WebhookType;
  /** Delivery status. */
  status: WebhookStatus;
  /** Optional message. */
  message: string;
  /** Type-specific payload. */
  body: TBody;
}
