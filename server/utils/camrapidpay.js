// Thin CamRapidPay (KHQR / Bakong) client. Docs: https://docs.camrapidpay.com
// API key is sent in the request body (create) or query (status), per the API.
const BASE_URL = 'https://pay.camrapidpay.com';
const TIMEOUT_MS = 10000;

function apiKey() {
  const key = process.env.CAM_RAPID_PAY_API_KEY;
  if (!key) {
    const error = new Error('Payments are not configured.');
    error.status = 501;
    throw error;
  }
  return key;
}

async function withTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Create a KHQR payment. Returns the gateway payload incl. `qr_code` (the KHQR
// string to render) and `bill_number`. Throws with context on failure.
export async function createKhqrPayment({ amount, reference, webhookUrl }) {
  const res = await withTimeout(`${BASE_URL}/api/v1/khqr/create-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_key: apiKey(), amount, reference, webhook_url: webhookUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const error = new Error(data.message || `Payment creation failed (HTTP ${res.status}).`);
    error.status = 502;
    throw error;
  }
  return data;
}

// Server-to-server payment status check (authoritative). Returns one of
// Pending | Success | Expired (defaults to Pending if unconfigured/unreachable).
export async function checkKhqrStatus(reference) {
  if (!process.env.CAM_RAPID_PAY_API_KEY) return { status: 'Pending' };
  const params = new URLSearchParams({ api_key: process.env.CAM_RAPID_PAY_API_KEY, reference });
  try {
    const res = await withTimeout(`${BASE_URL}/check-transaction-api?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    return { status: data.status || 'Pending', ...data };
  } catch {
    return { status: 'Pending' };
  }
}
