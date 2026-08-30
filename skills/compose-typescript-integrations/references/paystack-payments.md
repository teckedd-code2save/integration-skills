# Paystack payments recipe

Use this recipe when adding Paystack payment collection to a TypeScript application. Default to a small one-time-payment integration unless the user explicitly asks for subscriptions, transfers, split payments, or direct mobile-money charging.

Authoritative sources:

- Accept payments: https://paystack.com/docs/payments/accept-payments/
- Verify payments: https://paystack.com/docs/payments/verify-payments/
- Webhooks: https://paystack.com/docs/payments/webhooks/
- Payment channels: https://paystack.com/docs/payments/payment-channels/
- Test payments: https://paystack.com/docs/payments/test-payments/
- Official Node SDK: https://github.com/PaystackOSS/paystack-node
- Official MCP server: https://github.com/PaystackOSS/paystack-mcp-server
- Official OpenAPI specification: https://github.com/PaystackOSS/openapi

## Inspect and choose the smallest flow

Determine the framework, package manager, existing order or invoice model, authenticated user source, currency, country, callback URL, deployment environment, and whether the user wants hosted checkout, popup checkout, or a channel-specific flow.

Prefer:

- **Hosted redirect** for the smallest integration. Initialize on the server and redirect to `authorization_url`.
- **Popup V2** when checkout must remain in the application. Initialize on the server, return only the `access_code`, and resume with `@paystack/inline-js` in the browser.
- **Charge API** only when the product must collect a specific payment instrument such as Ghana mobile money directly.
- **better-auth-paystack** only when the project already uses Better Auth and needs its billing, subscription, or organization integration. Do not introduce Better Auth merely to collect a one-time payment.

Use the official `@paystack/paystack-sdk` when its current API covers the required operation and the repository prefers SDKs. A small server-only `fetch` adapter is reasonable for initialize and verify operations. Do not add both.

## Lead account and test setup

If the user has no Paystack account, guide them to https://dashboard.paystack.com/ and let them complete sign-up, business verification, MFA, settlement details, and legal acceptance. Never ask them to paste a secret key into chat.

Store the test secret key in the application's established local secret file or deployment secret store:

```dotenv
PAYSTACK_SECRET_KEY=
```

The secret key is server-only. A public key is needed only for a client library that explicitly requires it. Do not add a public variable by default when the flow uses a server-created authorization URL or access code.

The official Paystack MCP server can give an agent current endpoint details and make test API calls. It is in public preview and rejects live keys. Configure it only when it materially helps testing, use an environment-backed test key, and never commit the key in MCP configuration:

```bash
PAYSTACK_TEST_SECRET_KEY=sk_test_... npx @paystack/mcp-server
```

Do not pass a key directly in a recorded command, even when the MCP README demonstrates that option. The Paystack CLI can test API calls and webhooks; inspect its installed help before using commands because its interface may differ by version.

## Implement the payment boundary

For a Next.js App Router or Express TypeScript server, scaffold the server modules:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add paystack --target .
```

The Express variant includes raw-body middleware and handler factories. Mount `paystackWebhookBody` on the webhook path before global JSON parsing. Paystack intentionally has no Vite-only starter because initialization, verification, secrets, and trusted amount resolution belong on the server.

The starter has no runtime dependency beyond Node and the web `fetch` API. It provides `createPaystackInitializeRoute` and `createPaystackWebhookRoute`. Compose an initialize route with a trusted order lookup:

```ts
import { createPaystackInitializeRoute } from "@/integrations/paystack/next-routes";
import { createPaymentReference, toPaystackSubunit } from "@/integrations/paystack/money";

export const POST = createPaystackInitializeRoute({
  async resolvePayment(request) {
    const user = await requireCurrentUser(request);
    const order = await requirePayableOrder(request, user.id);
    return {
      email: user.email,
      amount: toPaystackSubunit(order.total),
      reference: order.paymentReference ?? createPaymentReference(order.id),
      currency: "GHS",
      channels: ["card", "mobile_money"],
      metadata: { orderId: order.id },
    };
  },
});
```

`requireCurrentUser` and `requirePayableOrder` represent application-owned authorization and persistence; implement them using the existing domain rather than copying browser values. Build the webhook route with the provided factory and route every `charge.success` event through one durable, idempotent completion service.

Keep all authoritative payment decisions on the server:

1. Load the order or invoice by its internal identifier.
2. Confirm the current user may pay it and that it is still payable.
3. Calculate the amount and currency from server-side data. Never accept the final amount from the browser.
4. Convert the amount to the currency's lower denomination without floating-point arithmetic.
5. Create or reuse a unique internal payment reference and persist a pending attempt before redirecting the customer.
6. Initialize the Paystack transaction from the server.
7. Return only the authorization URL or access code needed by the chosen frontend flow.
8. Treat callback query parameters and popup success callbacks as navigation signals, not proof of payment.
9. Verify the transaction server-side and compare status, reference, amount, currency, and the associated order before delivering value.
10. Process `charge.success` webhooks idempotently so retries cannot deliver value twice.

For Ghana, use `GHS`. Paystack supports MTN (`mtn`), ATMoney/Airtel Money (`atl`), and Telecel (`vod`) mobile-money providers. Direct mobile-money charges can enter `pay_offline`; show Paystack's returned display text and wait for the `charge.success` webhook rather than marking the order paid from the initial response.

## Copy-ready server adapter

Use this only when a direct server `fetch` adapter fits the repository better than the official SDK. Adapt error types to the project's conventions.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

type InitializePayment = {
  email: string;
  amount: number;
  reference: string;
  currency?: "GHS" | "NGN" | "ZAR" | "KES" | "USD";
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

function secretKey(): string {
  const value = process.env.PAYSTACK_SECRET_KEY;
  if (!value) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return value;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${secretKey()}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? `Paystack request failed (${response.status})`);
  }
  return body;
}

export function initializePaystackPayment(input: InitializePayment) {
  return paystack<{
    status: boolean;
    data: { authorization_url: string; access_code: string; reference: string };
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amount,
      reference: input.reference,
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export function verifyPaystackPayment(reference: string) {
  return paystack<{
    status: boolean;
    data: {
      status: string;
      reference: string;
      amount: number;
      currency: string;
    };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export function hasValidPaystackSignature(
  rawBody: string | Buffer,
  signature: string | null,
): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
```

Use the exact raw request body for signature verification when the framework provides it. Verify the `x-paystack-signature` HMAC SHA-512 signature before parsing or processing the event. After signature validation, durably record or enqueue the event with an idempotency guard, return `200 OK` promptly, and perform slow side effects outside the request when the architecture supports it.

## Configure callbacks and webhooks

- Configure separate test and live callback and webhook URLs.
- The webhook endpoint must be public HTTPS; localhost cannot receive Paystack deliveries without a tunnel or relay.
- Never mark an order paid merely because the callback route was visited.
- Use one canonical payment-completion service from both verify and webhook paths so concurrent delivery cannot duplicate fulfillment.
- Record enough information for reconciliation: internal order, Paystack reference, expected and received amount/currency, provider status, and timestamps. Do not store card data.
- Promote live keys or change production webhook settings only when the user has explicitly authorized production setup.

## Verify

Run the project's typecheck, lint, tests, and build. In Paystack test mode, verify:

1. An unauthenticated or unauthorized user cannot initialize payment for another user's order.
2. The browser cannot choose or alter the final amount.
3. Initialization returns a Paystack authorization URL or access code and persists the same reference.
4. A successful test payment remains pending until server verification or a valid webhook confirms it.
5. A forged signature is rejected without changing payment state.
6. Replaying the same valid webhook does not fulfill the order twice.
7. A mismatched amount, currency, or reference does not deliver value.
8. For Ghana mobile money, the pending/offline authorization state is visible and final status comes from verification or `charge.success`.

Report test-mode completion separately from live readiness. Live readiness also requires an activated Paystack business, live keys stored in the deployment environment, production callback/webhook configuration, and a real low-value end-to-end payment authorized by the user.
