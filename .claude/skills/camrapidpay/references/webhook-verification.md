# Webhook Signature Verification

CamRapidPay sends webhooks signed with the merchant's webhook secret. Verifying the signature is what separates a legitimate gateway notification from a forged "payment success" POST sent by an attacker who knows your endpoint URL.

## The general recipe

1. Capture the **raw request body** (bytes), before any JSON parsing.
2. Read the signature header (typically `X-Signature` — confirm name from docs).
3. Recompute `HMAC-SHA256(raw_body, webhook_secret)` and hex-encode.
4. Compare with `crypto.timingSafeEqual` — never `===`. A naive equality check leaks signature length via timing.
5. If signatures don't match, return `401` and stop. Do not log the body as "verified".

## Express example

The trap: `app.use(express.json())` consumes and rewrites the request stream. By the time your handler runs, `req.body` is a parsed object — re-stringifying it won't match what CamRapidPay signed (whitespace, key order, escaping all differ). Capture the raw body first.

```ts
import express from "express";
import crypto from "node:crypto";

const app = express();

// For the webhook route only, capture the raw body before parsing.
app.post(
  "/webhooks/camrapidpay",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const secret = process.env.CAMRAPIDPAY_WEBHOOK_SECRET!;
    const signature = req.header("X-Signature") ?? "";

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body) // req.body is a Buffer here
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return res.status(401).send("invalid signature");
    }

    const event = JSON.parse(req.body.toString("utf8"));
    // handle event idempotently using event.transaction_id
    res.status(200).send("ok");
  }
);
```

## Next.js (App Router) example

```ts
// app/api/webhooks/camrapidpay/route.ts
import crypto from "node:crypto";

export async function POST(req: Request) {
  const rawBody = await req.text(); // raw, not req.json()
  const signature = req.headers.get("x-signature") ?? "";

  const expected = crypto
    .createHmac("sha256", process.env.CAMRAPIDPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");

  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  // handle event idempotently
  return new Response("ok", { status: 200 });
}
```

## Idempotency

CamRapidPay may retry webhooks if your endpoint times out or returns non-2xx. To handle duplicates safely:

- Treat `transaction_id` (or `event_id` if provided) as a unique key.
- Before applying the event, check whether you've already recorded it. A simple `processed_webhooks(transaction_id PRIMARY KEY)` table works.
- Wrap the "mark order paid" + "record webhook" steps in a single transaction so a crash in the middle doesn't desync state.

## When verification fails

If the signature never matches in development, the most common causes (in order):

1. **Body parser ate the raw bytes.** Solved by `express.raw()` or `req.text()` as shown.
2. **Wrong secret.** Sandbox and production have different webhook secrets — confirm the env.
3. **Wrong algorithm or encoding.** Some gateways use base64 instead of hex, or HMAC-SHA512. Check the docs.
4. **Timestamp tolerance.** Some gateways include an `X-Timestamp` and require you sign `timestamp + body`. Confirm from docs and adjust.

If after all of that it still fails, log the raw body length and first 100 bytes — comparing those against what the gateway dashboard says it sent usually reveals a transport-level issue (e.g., a proxy adding a trailing newline).
