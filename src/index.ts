// PSP / Apple Pay / Google Pay client
export { BonumClient } from "./client.js";
export { loadConfigFromEnv } from "./config.js";

// Gateway Merchant API client
export { BonumGatewayClient } from "./gateway-client.js";
export { loadGatewayConfigFromEnv } from "./gateway-config.js";

// Webhook helpers
export {
  computeWebhookChecksum,
  verifyWebhookChecksum,
  parseWebhookEvent,
} from "./webhook.js";

// Shared error
export { BonumError } from "./errors.js";

// PSP types
export type {
  BonumConfig,
  ProcessPaymentInput,
  ProcessGooglePayInput,
  MerchantValidateInput,
  PaymentProcessResponse,
  PaymentLogEntry,
  PaymentProcessRequestWire,
  GooglePayProcessRequestWire,
  MerchantValidateRequestWire,
  PaymentProcessResponseWire,
  PaymentLogEntryWire,
} from "./types.js";

// Gateway types
export type {
  BonumGatewayConfig,
  PaymentProvider,
  InvoiceItem,
  ExtraInputType,
  InvoiceExtra,
  CreateInvoiceInput,
  InvoiceResponse,
  TokenizePayment,
  TokenizeSubscription,
  RequestCardTokenInput,
  RequestCardTokenResponse,
  PurchaseInput,
  PurchaseResponse,
  RecurringType,
  PaymentPlan,
  SubscribeInput,
  CreateQrInput,
  QrLink,
  QrResponse,
  PayQrInput,
  WebhookType,
  WebhookStatus,
  WebhookEvent,
} from "./gateway-types.js";
