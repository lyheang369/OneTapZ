---
name: camrapidpay
description: Integrate the CamRapidPay KHQR / Bakong payment gateway (https://camrapidpay.com, docs at https://docs.camrapidpay.com) in Node.js / TypeScript projects. Use this skill whenever the user mentions CamRapidPay, KHQR, Bakong, Cambodia payment gateway, "accept QR payments", merchant ID + API key for KHQR, payment webhooks for KHQR, or asks to generate a payment QR / check transaction status / verify a payment callback in a Cambodian merchant context — even if they don't say "CamRapidPay" by name. Covers KHQR generation, payment status polling, webhook signature verification, refunds, and listing transactions.
---

# CamRapidPay Integration Skill

This skill helps integrate **CamRapidPay** — a payment gateway for Cambodia's KHQR (Bakong) network — into Node.js / TypeScript applications.

## When to use this skill

Use when the user is:
- Generating a KHQR / payment QR code for a customer
- Checking whether a transaction has been paid
- Receiving and verifying a CamRapidPay webhook callback
- Refunding a transaction or listing recent transactions
- Building a merchant checkout that accepts Bakong payments via CamRapidPay
- Debugging a CamRapidPay integration (auth errors, wrong signatures, missing callbacks)

If the user mentions a **different** Cambodian payment gateway (PPCBank KHQR, ABA PayWay, BakongAPI.com, KHQRPay), this skill's general patterns still apply but the exact endpoints differ — flag that and ask which provider they're using.

## High-level integration flow

A typical CamRapidPay flow has three moving pieces:

1. **Server → CamRapidPay**: Create a payment. The server calls CamRapidPay with merchant credentials, an order ID, and the amount. CamRapidPay returns a KHQR string (and usually a QR image URL or rendered base64) plus a payment/transaction ID.
2. **Customer**: Scans the QR with any Bakong-supported wallet (ABA, ACLEDA, Wing, etc.) and pays.
3. **CamRapidPay → Server**: Sends a webhook callback notifying the server of the payment result. The server **must verify the signature** before trusting the callback, then mark the order paid in its own database. As a fallback, the server can also poll a status endpoint.

The reason the server should never trust the client to confirm payment is that anyone can hit the server's success URL — only the signed webhook (or a server-to-server status check) is authoritative.

## Credentials and environment variables

Always load credentials from environment variables — never hard-code them. The conventional names for this skill are:

```
CAMRAPIDPAY_API_BASE_URL=https://api.camrapidpay.com   # confirm exact base from docs
CAMRAPIDPAY_MERCHANT_ID=...
CAMRAPIDPAY_API_KEY=...                                 # or PUBLIC_KEY / SECRET_KEY pair
CAMRAPIDPAY_WEBHOOK_SECRET=...                          # for verifying callbacks
CAMRAPIDPAY_ENV=sandbox                                  # or "production"
```

If the user hasn't set up `.env` yet, suggest adding these and reading them via `process.env` (Node) — and remind them to add `.env` to `.gitignore` if they haven't already.

## API reference

Detailed endpoint shapes live in `references/api.md`. Read it when you need exact request/response fields. The reference is a placeholder until the official CamRapidPay docs are pasted in — many fields are marked `[TODO: confirm from docs]`. When the user shares docs (text, OpenAPI spec, or screenshots), update `references/api.md` first, then write code against it.

## Webhook verification

Webhooks are not safe to trust without verification — a stranger could forge a "payment success" POST to your endpoint. The verification recipe lives in `references/webhook-verification.md`. The pattern is HMAC-style: CamRapidPay signs the raw request body with the shared webhook secret, you recompute the signature server-side, and compare with `crypto.timingSafeEqual` to avoid timing-attack leaks.

Critically: verify against the **raw request body bytes**, not a re-stringified parsed JSON object. Frameworks like Express must capture the raw body before `body-parser` rewrites it, otherwise the signature will never match. This is the #1 reason webhook verification fails on first integration.

## Code generation guidance

When asked to write integration code:

1. **Prefer a thin client class** over scattered `fetch` calls. A `CamRapidPayClient` with methods (`createPayment`, `getPaymentStatus`, `refund`, `listTransactions`, `verifyWebhook`) makes the integration testable and consistent. A starter is in `scripts/camrapidpay-client.ts` — read it and adapt to the actual API shape from `references/api.md`.

2. **Use `node:crypto` for HMAC** — it's built-in, no dependency needed. Avoid pulling in `crypto-js` or similar.

3. **Set explicit timeouts** on outbound calls (e.g., `AbortController` with a 10-second timeout). Payment APIs occasionally hang, and an unbounded fetch will tie up server resources.

4. **Surface errors with context, don't swallow them.** If a payment creation fails, throw an error that includes the HTTP status, the CamRapidPay error code, and the order ID. Silent failures on payments are how merchants end up with mystery missing orders.

5. **Idempotency**: when retrying a failed `createPayment` call, reuse the same internal order ID. CamRapidPay's docs should specify whether the API supports an idempotency key — if so, send it.

6. **Currency**: KHQR supports both KHR (riel) and USD. Confirm which the merchant is set up for and pass the right currency code in every request. The amount unit may be the major unit (USD as a decimal) or the minor unit (cents/lowest denomination) — confirm from the docs and document it in `references/api.md` so future invocations don't get this wrong.

## Common pitfalls

- **Polling instead of using webhooks**: polling works but wastes requests and adds latency. Always implement webhooks if the user is building anything beyond a one-off script. Polling is fine as a *fallback* for missed webhooks.
- **Trusting webhook payloads without signature verification**: see above. Verify or you have an open-door fraud risk.
- **Not handling duplicate webhooks**: CamRapidPay may retry webhooks if your endpoint times out. Process payments idempotently — keying off the gateway transaction ID — so a duplicate delivery doesn't double-credit the order.
- **Wrong base URL for sandbox vs production**: a request that returns 404 or 401 in sandbox usually means the URL or API key is from the other environment. Make this an env var.
- **Mishandling decimal precision on KHR**: KHR has no fractional unit at retail. Round to whole riel, or you'll get rejected payments.

## Output format guidance

When generating code, default to:
- TypeScript with explicit types for request/response shapes
- ES modules (`import`/`export`), unless the project's `package.json` indicates CommonJS
- Match the project's existing style — check `tsconfig.json` and any nearby `.ts` files first
- Include a short usage comment at the top of any new client file showing one example call

When generating curl commands or quick tests, include the env var names rather than placeholder strings, so the user can paste and run with their shell already loaded.

## What to do if the docs change or are unclear

If `references/api.md` has placeholders that block writing correct code:

1. Tell the user clearly that you need the specific fields/endpoint, and ask them to paste the relevant page from `https://docs.camrapidpay.com`.
2. While waiting, you can scaffold the surrounding code (route handlers, env-var loading, type interfaces) and leave the actual API call as a clearly marked `TODO` — this keeps progress moving.
3. Update `references/api.md` once they share — that way future invocations of this skill don't hit the same gap.
