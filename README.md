# TypeScript Integration Skills

A small, agent-first collection for adding maintained third-party capabilities to existing TypeScript applications.

The project does not replace provider SDKs or freeze vendor snippets. Each recipe teaches an agent how to discover the target project, use the provider's official CLI or skill, guide account and key setup, refine generated code, and verify the finished integration.

## Point an agent at it

Give a coding agent this instruction from the root of a TypeScript project:

```text
Install the compose-typescript-integrations skill from https://github.com/teckedd-code2save/integration-skills, then use it to add <capability> to this project. Inspect the existing stack, lead me through any account or key setup I must do, implement the integration, and verify it end to end.
```

Replace `<capability>` with a concrete request such as:

- `Clerk Google and phone authentication`
- `Paystack card and Ghana mobile-money checkout`
- `private Cloudflare R2 uploads`
- `Mapbox Ghana-biased place search and a selectable map`

If the agent already supports the Skills CLI, install it directly:

```bash
npx skills add teckedd-code2save/integration-skills --skill compose-typescript-integrations
```

Then ask normally:

```text
Use $compose-typescript-integrations to add Clerk Google and phone authentication to this application.
```

## Available recipes

### Clerk authentication

The first recipe composes Clerk's official CLI and skills. It covers project inspection, account linking, requested login-method configuration, environment keys, code refinement, and verification.

Example request:

> Use `$compose-typescript-integrations` to add Clerk Google and phone authentication to this Next.js application.

### Paystack payments

The Paystack recipe composes its official TypeScript SDK, OpenAPI specification, CLI, and test-only MCP server. It supports hosted checkout, Popup V2, Ghana mobile money, verified callbacks, signed webhooks, idempotency, and test-to-live guidance.

Example request:

> Use `$compose-typescript-integrations` to add Paystack mobile-money and card payments to this TypeScript application.

### Cloudflare R2 storage

The R2 recipe selects between a native Worker binding, an S3-compatible Node/VPS client, and short-lived presigned browser access. It guides bucket and credential setup, least-privilege access, upload authorization, and a real object round-trip test.

Example request:

> Use `$compose-typescript-integrations` to add private Cloudflare R2 uploads to this Next.js application.

### Mapbox location and search

The Mapbox recipe composes its official agent skills and optional MCP servers, then guides token creation, web integration, search/geocoding, Ghana-aware result behavior, geolocation permissions, routing, and live verification.

Example request:

> Use `$compose-typescript-integrations` to add Ghana-biased place search and a selectable map to this React application.

## Local development

Preview or install the local skill before publishing changes:

```bash
npx skills add . --list
npx skills add . --skill compose-typescript-integrations
```

## Principles

- Compose maintained upstream tools instead of copying them.
- Ask only for information the developer has not already provided.
- Lead exact account and key setup without exposing secrets in chat.
- Modify existing applications rather than forcing a starter template.
- Verify real behavior before reporting success.

## Next candidates

- Resend transactional email
- Sentry monitoring
- Hubtel messaging and payments
