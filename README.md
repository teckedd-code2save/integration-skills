# TypeScript Integration Skills

A small, agent-first collection for adding maintained third-party capabilities to existing TypeScript applications.

It combines provider SDKs and CLIs with executable TypeScript starters. The included scaffolder safely copies maintained adapters, route factories, components, and environment placeholders into an existing Next.js App Router project without overwriting user files by default.

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

The agent can scaffold one or several starters with:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs list
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add clerk --target . --install
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add paystack r2 mapbox --target . --install
```

Existing files are preserved and reported for deliberate merging. `--dry-run` previews changes; `--force` is available only when replacement is intentional.

## Available recipes

### Clerk authentication

The Clerk recipe includes version-aware Next.js middleware/proxy, a provider wrapper, sign-in and sign-up pages, account controls, and a protected API example. It composes Clerk's CLI for account linking and Google/phone configuration.

Example request:

> Use `$compose-typescript-integrations` to add Clerk Google and phone authentication to this Next.js application.

### Paystack payments

The Paystack recipe includes a server client, precise subunit conversion, reference generation, verification assertions, raw-body webhook signature validation, and Next.js route factories. It supports hosted checkout, Ghana mobile money, idempotent webhooks, and test-to-live guidance.

Example request:

> Use `$compose-typescript-integrations` to add Paystack mobile-money and card payments to this TypeScript application.

### Cloudflare R2 storage

The R2 recipe includes a lazy S3-compatible client, safe object-key generation, object operations, short-lived presigned URLs, browser upload, and authorization-aware Next.js route factories.

Example request:

> Use `$compose-typescript-integrations` to add private Cloudflare R2 uploads to this Next.js application.

### Mapbox location and search

The Mapbox recipe includes a client-only React location picker with Search Box, a live map, selected-place marker, Ghana defaults, and an explicit longitude/latitude result contract.

Example request:

> Use `$compose-typescript-integrations` to add Ghana-biased place search and a selectable map to this React application.

## Local development

Preview or install the local skill before publishing changes:

```bash
npx skills add . --list
npx skills add . --skill compose-typescript-integrations
node skills/compose-typescript-integrations/scripts/test-scaffold.mjs
```

## Principles

- Compose maintained upstream tools instead of copying them.
- Keep reusable provider code behind small application-owned interfaces.
- Ask only for information the developer has not already provided.
- Lead exact account and key setup without exposing secrets in chat.
- Modify existing applications rather than forcing a starter template.
- Verify real behavior before reporting success.

## Next candidates

- Resend transactional email
- Sentry monitoring
- Hubtel messaging and payments
