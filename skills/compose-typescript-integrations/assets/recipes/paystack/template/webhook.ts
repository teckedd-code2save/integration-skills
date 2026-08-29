import { createHmac, timingSafeEqual } from "node:crypto";

export type PaystackWebhookEvent<T = unknown> = {
  event: string;
  data: T;
};

function secretKey() {
  const value = process.env.PAYSTACK_SECRET_KEY;
  if (!value) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return value;
}

export function hasValidPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function parsePaystackWebhook<T = unknown>(
  rawBody: string,
  signature: string | null,
): PaystackWebhookEvent<T> {
  if (!hasValidPaystackSignature(rawBody, signature)) {
    throw new Error("Invalid Paystack signature");
  }
  return JSON.parse(rawBody) as PaystackWebhookEvent<T>;
}
