/**
 * CamRapidPay client — https://pay.camrapidpay.com
 * Docs: https://docs.camrapidpay.com
 *
 * Example:
 *   const client = new CamRapidPayClient({
 *     apiKey: process.env.CAM_RAPID_PAY_API_KEY!,
 *   });
 *   const payment = await client.createPayment({ orderId: "ORD-123", amount: 10, currency: "USD" });
 */

import crypto from "node:crypto";

export type PaymentStatus = "Pending" | "Success" | "Expired";

export interface CamRapidPayConfig {
  apiKey: string;
  baseUrl?: string;   // defaults to https://pay.camrapidpay.com
  timeoutMs?: number;
}

export interface CreatePaymentInput {
  reference: string;  // unique per transaction, max 50 chars
  amount: number;     // USD, must be > 0
  webhookUrl?: string;
}

export interface CreatePaymentResponse {
  success: boolean;
  message: string;
  status: PaymentStatus;
  paymentUrl: string;
  billNumber: string;
  amount: number;
  merchantName: string;
  qrCode: string;      // raw EMV KHQR string — render with a QR library
  createdAt: string;
  expiresIn: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  status: PaymentStatus;
  message: string;
}

export interface WebhookPayload {
  status: string;
  message: string;
  reference: string;
  amount: string;
  currency: string;
  bakong_id: string;
  merchant_name: string;
  created_at: string;
}

export class CamRapidPayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "CamRapidPayError";
  }
}

export class CamRapidPayClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: CamRapidPayConfig) {
    this.baseUrl = cfg.baseUrl ?? "https://pay.camrapidpay.com";
    this.timeoutMs = cfg.timeoutMs ?? 10_000;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResponse> {
    const data = await this.post<any>("/api/v1/khqr/create-payments", {
      api_key: this.cfg.apiKey,
      amount: input.amount,
      reference: input.reference,
      webhook_url: input.webhookUrl,
    });
    return {
      success: data.success,
      message: data.message,
      status: data.status,
      paymentUrl: data.payment_url,
      billNumber: data.bill_number,
      amount: data.amount,
      merchantName: data.merchant_name,
      qrCode: data.qr_code,
      createdAt: data.created_at,
      expiresIn: data.expires_in,
    };
  }

  async getPaymentStatus(reference: string): Promise<PaymentStatusResponse> {
    const qs = new URLSearchParams({ api_key: this.cfg.apiKey, reference });
    return this.get<PaymentStatusResponse>(`/check-transaction-api?${qs}`);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new CamRapidPayError(data?.message ?? `HTTP ${res.status}`, res.status);
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      return res.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
