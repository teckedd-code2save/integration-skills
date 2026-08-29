const PAYSTACK_BASE_URL = "https://api.paystack.co";

export type PaystackCurrency = "GHS" | "NGN" | "ZAR" | "KES" | "USD";
export type PaystackChannel =
  | "card"
  | "bank"
  | "apple_pay"
  | "ussd"
  | "qr"
  | "mobile_money"
  | "bank_transfer"
  | "eft"
  | "capitec_pay"
  | "payattitude";

export type InitializePaystackPayment = {
  email: string;
  amount: number;
  reference: string;
  currency?: PaystackCurrency;
  callbackUrl?: string;
  channels?: PaystackChannel[];
  metadata?: Record<string, unknown>;
};

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type VerifiedPaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel: string;
  paid_at: string | null;
  metadata: unknown;
};

function secretKey() {
  const value = process.env.PAYSTACK_SECRET_KEY;
  if (!value) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return value;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<PaystackEnvelope<T>> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${secretKey()}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, { ...init, headers });
  const body = (await response.json()) as PaystackEnvelope<T>;
  if (!response.ok || !body.status) {
    throw new Error(body.message || `Paystack request failed (${response.status})`);
  }
  return body;
}

export function initializePaystackPayment(input: InitializePaystackPayment) {
  return paystack<{ authorization_url: string; access_code: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amount),
        reference: input.reference,
        currency: input.currency,
        callback_url: input.callbackUrl,
        channels: input.channels,
        metadata: input.metadata,
      }),
    },
  );
}

export function verifyPaystackPayment(reference: string) {
  return paystack<VerifiedPaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function assertVerifiedPayment(
  transaction: VerifiedPaystackTransaction,
  expected: { reference: string; amount: number; currency: PaystackCurrency },
) {
  if (transaction.status !== "success") throw new Error("Payment is not successful");
  if (transaction.reference !== expected.reference) throw new Error("Payment reference mismatch");
  if (transaction.amount !== expected.amount) throw new Error("Payment amount mismatch");
  if (transaction.currency !== expected.currency) throw new Error("Payment currency mismatch");
  return transaction;
}
