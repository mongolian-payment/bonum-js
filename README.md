# @mongolian-payment/bonum

Bonum payment SDK for Node.js. Two clients in one package:

- **`BonumGatewayClient`** — the full Bonum Gateway Merchant API: Bearer-token
  auth (with auto-refresh), web-payment invoices, card tokenization,
  subscriptions, QR / deeplink, and webhook checksum verification.
- **`BonumClient`** — PSP card processing for Apple Pay, Google Pay and direct
  tokens (`psp.bonum.mn`).

## Installation

```bash
npm install @mongolian-payment/bonum
```

Requires Node.js >= 18.0.0 (uses native `fetch` and `node:crypto`).

---

## Gateway client

```typescript
import { BonumGatewayClient } from '@mongolian-payment/bonum';

const client = new BonumGatewayClient({
  baseUrl: 'https://testapi.bonum.mn', // production: https://apis.bonum.mn
  appSecret: process.env.BONUM_APP_SECRET!,
  terminalId: process.env.BONUM_TERMINAL_ID!,
  checksumKey: process.env.BONUM_MERCHANT_CHECKSUM_KEY, // for webhook verification
});

// 1) Web payment — create an invoice and redirect the payer
const invoice = await client.createInvoice({
  amount: 1000,
  callback: 'https://your-domain.com/webhook',
  transactionId: 'ORDER-123',
  providers: ['QPAY'], // optional: QPAY | E_COMMERCE | WE_CHAT | SONO_SHOP
});
// redirect the payer to invoice.followUpLink

// 2) Card tokenization + purchase
const tok = await client.requestCardToken({
  callback: 'https://your-domain.com/card-callback',
  transactionId: 'TOK-1',
});
// after the CARD-TOKEN webhook delivers the token:
const purchase = await client.purchaseWithCardToken({
  cardToken: 'stored-card-token',
  amount: 15000,
  transactionId: 'PUR-1',
});
console.log(purchase.httpStatus); // 200 = success, 201 = queued, 400 = declined

// 3) QR / deeplink
const qr = await client.createQr({ amount: 10000, transactionId: 'QR-1' });
// render qr.qrImage as <img src="data:image/png;base64,..."> and qr.links as deeplinks
```

### Authentication

Auth is automatic. The client calls `GET /bonum-gateway/ecommerce/auth/create`
with `Authorization: AppSecret <appSecret>` and `X-TERMINAL-ID`, caches the
Bearer token, and refreshes it before expiry (access token ~30 min). Bonum
rate-limits new token requests, so reuse a client instance.

### Gateway methods

| Method | Description |
|--------|-------------|
| `getPaymentProviders()` | List available invoice providers |
| `createInvoice(input)` | Create a web-payment invoice → `{ invoiceId, followUpLink }` |
| `getInvoice(invoiceId)` | Get an invoice (test helper) |
| `requestCardToken(input)` | Start card tokenization → `{ followUpLink, id }` |
| `purchaseWithCardToken(input)` | Charge a stored card token |
| `rollbackTransaction(cardToken, id)` | Refund a completed purchase |
| `listPaymentPlans()` | List subscription plans |
| `subscribe(input)` | Subscribe a card token to a plan |
| `listSubscriptions(cardToken)` | List a token's subscriptions |
| `changeSubscriptionToken(id, cardToken)` | Move a subscription to another token |
| `changeSubscriptionWithNewToken(id)` | Link a brand-new token to a subscription |
| `cancelSubscription(id)` | Cancel (active until next cycle) |
| `deleteSubscription(id)` | Delete permanently |
| `createQr(input)` | Create a QPay QR with bank deeplinks |
| `payQr(input)` | Pay a scanned QR with a stored card token |

### Webhook verification

Bonum signs webhook deliveries with `HmacSHA256(rawBody, checksumKey)` (hex) in
the `x-checksum-v2` header. Verify over the **raw** request body:

```typescript
import { verifyWebhookChecksum, parseWebhookEvent } from '@mongolian-payment/bonum';

app.post('/webhook', express.text({ type: '*/*' }), (req, res) => {
  const ok = verifyWebhookChecksum(
    req.body,                       // raw string body
    req.header('x-checksum-v2'),
    process.env.BONUM_MERCHANT_CHECKSUM_KEY!,
  );
  if (!ok) return res.sendStatus(401);

  const event = parseWebhookEvent(req.body);
  // event.type: PAYMENT | CARD-TOKEN | SUBSCRIPTION-PAYMENT
  // event.status: SUCCESS | FAILED
  res.sendStatus(200);
});
```

---

## PSP client (Apple Pay / Google Pay)

```typescript
import { BonumClient } from '@mongolian-payment/bonum';

const psp = new BonumClient({
  endpoint: 'https://psp.bonum.mn', // test: https://testpsp.bonum.mn
  merchantKey: process.env.BONUM_MERCHANT_KEY!,
});

await psp.processPayment({ token: 'apple-pay-token', orderId: 'ORDER-001' });
await psp.processGooglePay({ token: 'gpay-token', orderId: 'ORDER-002', amount: 5000, currencyCode: 'MNT' });
await psp.validateMerchant({ validationURL: 'https://apple-pay-gateway.apple.com/...' });
const logs = await psp.getPaymentLog('ORDER-001');
```

| Method | Description |
|--------|-------------|
| `processPayment(input)` | Process payment with a card/Apple Pay token |
| `processGooglePay(input)` | Process a Google Pay payment |
| `validateMerchant(input)` | Validate an Apple Pay merchant session |
| `getPaymentLog(orderId)` | Get payment log entries for an order |

---

## Environment Variables

```bash
# Gateway client
BONUM_GATEWAY_BASE_URL=https://testapi.bonum.mn
BONUM_APP_SECRET=your-app-secret
BONUM_TERMINAL_ID=your-terminal-id
BONUM_MERCHANT_CHECKSUM_KEY=your-checksum-key   # optional, for webhooks
BONUM_ACCEPT_LANGUAGE=mn                         # optional: mn | en

# PSP client
BONUM_ENDPOINT=https://psp.bonum.mn
BONUM_MERCHANT_KEY=your-merchant-key
```

```typescript
import {
  BonumGatewayClient, loadGatewayConfigFromEnv,
  BonumClient, loadConfigFromEnv,
} from '@mongolian-payment/bonum';

const gateway = new BonumGatewayClient(loadGatewayConfigFromEnv());
const psp = new BonumClient(loadConfigFromEnv());
```

> **Security.** Never hard-code or commit `APP_SECRET`, `MERCHANT_CHECKSUM_KEY`
> or merchant keys. Load them from the environment or a secrets vault. Apple Pay
> registration details (developer email, domain, webhook URL, etc.) are
> configured in the merchant portal — not in code.

## Endpoints

| Environment | Gateway | PSP |
|-------------|---------|-----|
| Production | `https://apis.bonum.mn` | `https://psp.bonum.mn` |
| Test | `https://testapi.bonum.mn` | `https://testpsp.bonum.mn` |

## Error Handling

```typescript
import { BonumError } from '@mongolian-payment/bonum';

try {
  await gateway.createInvoice(input);
} catch (err) {
  if (err instanceof BonumError) {
    console.error(err.message, err.statusCode, err.response);
  }
}
```

## License

MIT
