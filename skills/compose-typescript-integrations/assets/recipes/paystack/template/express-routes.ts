import { raw, type Request, type RequestHandler } from "express";
import { initializePaystackPayment, type InitializePaystackPayment } from "./client";
import { parsePaystackWebhook, type PaystackWebhookEvent } from "./webhook";

export const paystackWebhookBody = raw({ type: "application/json" });

export function createPaystackInitializeHandler(options: {
  resolvePayment(request: Request): Promise<InitializePaystackPayment>;
}): RequestHandler {
  return async (request, response) => {
    try {
      const payment = await options.resolvePayment(request);
      const result = await initializePaystackPayment(payment);
      response.json(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment initialization failed";
      response.status(400).json({ error: message });
    }
  };
}

export function createPaystackWebhookHandler(options: {
  handle(event: PaystackWebhookEvent): Promise<void>;
}): RequestHandler {
  return async (request, response) => {
    try {
      if (!Buffer.isBuffer(request.body)) throw new Error("Paystack webhook requires a raw body");
      const event = parsePaystackWebhook(
        request.body.toString("utf8"),
        request.header("x-paystack-signature") ?? null,
      );
      await options.handle(event);
      response.sendStatus(200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed";
      response.status(401).json({ error: message });
    }
  };
}
