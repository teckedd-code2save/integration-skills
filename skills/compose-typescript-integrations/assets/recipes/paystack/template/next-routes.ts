import { initializePaystackPayment, type InitializePaystackPayment } from "./client";
import { parsePaystackWebhook, type PaystackWebhookEvent } from "./webhook";

export function createPaystackInitializeRoute(options: {
  resolvePayment(request: Request): Promise<InitializePaystackPayment>;
}) {
  return async function POST(request: Request) {
    try {
      const payment = await options.resolvePayment(request);
      const result = await initializePaystackPayment(payment);
      return Response.json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment initialization failed";
      return Response.json({ error: message }, { status: 400 });
    }
  };
}

export function createPaystackWebhookRoute(options: {
  handle(event: PaystackWebhookEvent): Promise<void>;
}) {
  return async function POST(request: Request) {
    const rawBody = await request.text();
    let event: PaystackWebhookEvent;
    try {
      event = parsePaystackWebhook(rawBody, request.headers.get("x-paystack-signature"));
    } catch {
      return new Response("invalid webhook", { status: 401 });
    }
    try {
      await options.handle(event);
      return new Response("ok");
    } catch {
      return new Response("webhook processing failed", { status: 500 });
    }
  };
}
