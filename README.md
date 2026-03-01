# @mongolian-payment/bonum

Bonum PSP payment SDK for Node.js — card payment processing, Google Pay, Apple Pay.

## Installation

```bash
npm install @mongolian-payment/bonum
```

Requires Node.js >= 18.0.0 (uses native `fetch`).

## Quick Start

```typescript
import { BonumClient } from '@mongolian-payment/bonum';

const client = new BonumClient({
  endpoint: 'https://psp.bonum.mn',
  merchantKey: 'your-merchant-key',
});

// Process a payment (card token / Apple Pay token)
const result = await client.processPayment({
  token: 'payment-token-from-authorization',
  orderId: 'ORDER-001',
});
console.log(result.success); // true or false
console.log(result.statusCode);

// Process a Google Pay payment
const gpay = await client.processGooglePay({
  token: 'encrypted-google-pay-token',
  orderId: 'ORDER-002',
  amount: 5000,
  currencyCode: 'MNT',
});

// Validate merchant session (Apple Pay)
const session = await client.validateMerchant({
  validationURL: 'https://apple-pay-gateway.apple.com/...',
});

// Check payment log
const logs = await client.getPaymentLog('ORDER-001');
console.log(logs[0].success); // true
console.log(logs[0].amount); // 5000
```

## Environment Variables

```bash
BONUM_ENDPOINT=https://psp.bonum.mn
BONUM_MERCHANT_KEY=your-merchant-key
```

```typescript
import { BonumClient, loadConfigFromEnv } from '@mongolian-payment/bonum';
const client = new BonumClient(loadConfigFromEnv());
```

## API Methods

| Method | Description |
|--------|-------------|
| `processPayment(input)` | Process payment with card/Apple Pay token |
| `processGooglePay(input)` | Process Google Pay payment |
| `validateMerchant(input)` | Validate Apple Pay merchant session |
| `getPaymentLog(orderId)` | Get payment log entries for an order |

## Endpoints

| Environment | Base URL |
|-------------|----------|
| Production | `https://psp.bonum.mn` |
| Test | `https://testpsp.bonum.mn` |

## Error Handling

```typescript
import { BonumError } from '@mongolian-payment/bonum';

try {
  await client.processPayment(input);
} catch (err) {
  if (err instanceof BonumError) {
    console.error(err.message);    // "Bonum API error: POST /api/payment/process (401)"
    console.error(err.statusCode); // 401
    console.error(err.response);   // Raw response body
  }
}
```

## License

MIT
