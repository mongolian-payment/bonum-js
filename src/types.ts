// =============================================================================
// Configuration
// =============================================================================

/** Bonum PSP client configuration */
export interface BonumConfig {
  /** API endpoint (e.g. "https://psp.bonum.mn" or "https://testpsp.bonum.mn") */
  endpoint: string;
  /** Merchant key provided by Bonum PSP */
  merchantKey: string;
}

// =============================================================================
// Payment Processing
// =============================================================================

/** Input for processing a payment (Apple Pay / card token) */
export interface ProcessPaymentInput {
  /** Payment token from the payment authorization */
  token: string;
  /** Merchant order ID */
  orderId: string;
}

/** Input for processing a Google Pay payment */
export interface ProcessGooglePayInput {
  /** Encrypted Google Pay token */
  token: string;
  /** Merchant order ID */
  orderId: string;
  /** Payment amount */
  amount: number;
  /** Currency code (e.g. "MNT", "USD") */
  currencyCode: string;
}

/** Response from payment processing */
export interface PaymentProcessResponse {
  /** Whether the payment was successful */
  success: boolean;
  /** Status code */
  statusCode: string;
  /** Order ID */
  orderId: string;
  /** Description */
  desc: string;
}

// =============================================================================
// Merchant Validation (Apple Pay)
// =============================================================================

/** Input for Apple Pay merchant validation */
export interface MerchantValidateInput {
  /** Apple Pay validation URL from the payment session event */
  validationURL: string;
}

// =============================================================================
// Payment Log
// =============================================================================

/** A single payment log entry */
export interface PaymentLogEntry {
  /** Merchant order ID */
  merchantOrderId: string;
  /** Payment amount */
  amount: number;
  /** Whether the payment was successful */
  success: boolean;
  /** Timestamp when the log entry was created */
  createdAt: string;
}

// =============================================================================
// Wire types (API request/response shapes)
// =============================================================================

/** Wire format for payment process request */
export interface PaymentProcessRequestWire {
  token: string;
  orderId: string;
}

/** Wire format for Google Pay process request */
export interface GooglePayProcessRequestWire {
  token: string;
  order_id: string;
  amount: string;
  currency_code: string;
}

/** Wire format for merchant validate request */
export interface MerchantValidateRequestWire {
  validationURL: string;
}

/** Wire format for payment process response */
export interface PaymentProcessResponseWire {
  success: boolean;
  status_code: string;
  orderId: string;
  desc: string;
}

/** Wire format for payment log entry */
export interface PaymentLogEntryWire {
  merchant_order_id: string;
  amount: number;
  success: boolean;
  createdAt: string;
}
