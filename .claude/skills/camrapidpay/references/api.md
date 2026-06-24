# CamRapidPay API Reference

Confirmed from official docs at https://docs.camrapidpay.com.

## Base URL

- Production: `https://pay.camrapidpay.com`
- (No separate sandbox — use small amounts like $0.01 for testing)

## Authentication

The API key is sent **in the request body** (not in a header). The env var is `CAM_RAPID_PAY_API_KEY`.

```json
{ "api_key": "YOUR_CAM_RAPID_PAY_API_KEY", ... }
```

For the GET status endpoint, the key is sent as a URL-encoded query parameter.

## Endpoints

### 1. Create payment / Generate KHQR

**`POST https://pay.camrapidpay.com/api/v1/khqr/create-payments`**

Headers: `Content-Type: application/json`, `Accept: application/json`

Request body:

```json
{
  "api_key": "YOUR_CAM_RAPID_PAY_API_KEY",
  "amount": 1.50,
  "reference": "ORD-123",
  "webhook_url": "https://yoursite.com/webhook"
}
```

- `reference`: unique per transaction, max 50 chars
- `webhook_url`: optional; URL where CamRapidPay POSTs when payment completes
- Payment session expires in **5 minutes**
- Currency is USD; amount must be > 0

Response (success):

```json
{
  "success": true,
  "message": "Successful Create KHQR",
  "status": "Pending",
  "payment_url": "https://pay.camrapidpay.com/checkout/khqr/reference/REF_923XK",
  "bill_number": "REF_923XK",
  "amount": 1.50,
  "merchant_name": "Your Store",
  "qr_code": "000201010212267895802KH53038405402.756304ABCD",
  "created_at": "03/31/2026, 13:45:22",
  "expires_in": "5 minutes"
}
```

Response (failure):

```json
{ "success": false, "message": "Invalid API key or account inactive" }
```

### 2. Check payment status

**`GET https://pay.camrapidpay.com/check-transaction-api`**

Query parameters (URL-encoded):

```
?api_key=YOUR_KEY&reference=ORD-123
```

Use `--data-urlencode` with curl, or `URLSearchParams` in Node.js.

Response:

```json
{ "success": true, "status": "Success", "message": "Payment is Success" }
```

Status values: `Pending` · `Success` · `Expired`

### 3. Webhook callback (CamRapidPay → your server)

CamRapidPay POSTs to your `callback_url` when payment status changes.

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "status": "success",
  "message": "Payment successfully",
  "reference": "ORD-123",
  "amount": "1.50",
  "currency": "USD",
  "bakong_id": "merchant.bakongid",
  "merchant_name": "Your Store Name",
  "created_at": "2026-03-31T13:45:22.000Z"
}
```

**Important**: respond with `200 OK` quickly (under 5 seconds). If processing takes longer, return 200 immediately and queue the work. If you return non-2xx, CamRapidPay will retry — make sure your handler is idempotent (key off `transaction_id`).

See `webhook-verification.md` for the verification recipe.

### 4. Refunds / List transactions

Not documented in the current API reference. Manage via the merchant portal at https://portal.camrapidpay.com.

## Error responses

All errors return `{ "success": false, "message": "..." }`.

Common causes:
- Invalid / inactive API key
- Reference already used (must be unique per transaction)
- Amount <= 0
- Network timeout (retry with backoff)

## Key rules summary

- Amount > 0, USD
- Reference: unique, max 50 chars
- Payment expires in 5 minutes
- Webhook retries up to 5 times on non-200 response
- Process webhooks idempotently (key off `reference`)
