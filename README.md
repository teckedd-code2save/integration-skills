# TypeScript Integration Skills

A small, agent-first collection for adding maintained third-party capabilities to existing TypeScript applications.

It combines provider SDKs and CLIs with executable TypeScript starters. The included scaffolder safely copies maintained adapters, route factories, components, and environment placeholders into Next.js App Router, Vite + React, and Express TypeScript applications without overwriting user files by default.

## Point an agent at it

Give a coding agent this instruction from the root of a TypeScript project:

```text
Install and use the compose-typescript-integrations skill from https://github.com/teckedd-code2save/integration-skills. Set up and verify <capability> in this project.
```

Replace `<capability>` with a concrete request such as:

- `Clerk Google, LinkedIn, Telegram, and phone authentication`
- `vendor-neutral OIDC SSO`
- `Paystack card and Ghana mobile-money checkout`
- `private Cloudflare R2 uploads`
- `Mapbox or Google Maps Ghana-biased place search and a selectable map`
- `traffic-aware routing and ETA with Google or Mapbox`

If the agent already supports the Skills CLI, install it directly:

```bash
npx skills add teckedd-code2save/integration-skills --skill compose-typescript-integrations
```

Then ask normally:

```text
Use $compose-typescript-integrations to set up and verify R2 here.
```

That short outcome request is the intended interface for every recipe. On first use, the agent asks one question: **Auto (recommended)** or **Interactive** setup. Auto performs safe agent-capable work and pauses only for required access or approval. Interactive walks through external configuration step by step and asks before making external changes. The choice is stored for every integration in that application, so later agents do not ask again.

Each provider exposes the same agent actions, human-only actions, and completion criteria. The skill makes the agent responsible for inspecting and adapting existing code, using available provider connectors, protecting secrets, completing project tests, and running the provider's verification gate. In either mode it asks at the point where login, MFA, secure secret entry, billing/legal acceptance, a paid commitment, production promotion, a destructive action, or explicit provider permission is actually required.

The recommended command composes one or several integrations and records the choice for every later agent:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs list
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs inspect --target .
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose google-auth linkedin-auth telegram-auth paystack r2 google-maps routing-eta --target . --mode auto --install
```

For a frontend/backend monorepo, target each application workspace independently. For example:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose clerk mapbox r2 --target apps/web --mode auto --install
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose clerk paystack r2 --target apps/api --mode auto --install
```

The command rejects providers that do not belong on that target—for example, Paystack server code on a Vite browser app. `inspect` also surfaces SDK evidence for integrations that may already exist so the agent can preserve and adapt them.

That creates `integrations.config.json` with the selected `executionMode` plus consistent application imports:

```ts
import {
  createPaymentInitializeRoute,
  createStorageUploadRoute,
} from "@/integrations/server";
import { AuthControls } from "@/integrations/client/auth";
import { LocationPicker } from "@/integrations/client/location";
import { AppIntegrationsProvider } from "@/integrations/provider";
```

Any agent can later reapply or repair the declared set with:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose --target . --install
```

Existing files are preserved and reported for deliberate merging. `--dry-run` previews changes; `--force` is available only when replacement is intentional.

Scaffolding automatically continues into setup and verification work. Agents should run:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup r2 --target apps/api
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs doctor r2 --target apps/api --live
```

`setup` reveals only which values are present or missing, then gives the connector/CLI/dashboard walkthrough. The R2 live doctor creates one temporary probe object, reads it back, and deletes it. Existing SDKs are treated as evidence to investigate—not as proof that an integration is configured or works.

## Available recipes

### Clerk authentication

The Clerk recipe includes version-aware Next.js middleware/proxy, Vite + React providers and account controls, and Express authentication middleware. It composes Clerk's CLI for account linking and Google/phone configuration.

Example request:

> Use `$compose-typescript-integrations` to add Clerk Google and phone authentication to this Next.js application.

Google, LinkedIn, and Telegram are selectable method facets. They automatically compose Clerk so the app keeps one user/session authority and the setup report leads each provider's dashboard flow.

### Vendor-neutral OIDC SSO

The OIDC recipe uses discovery, Authorization Code flow, S256 PKCE, state, nonce, and verified ID-token claims. Next.js and Express receive route factories that plug into the application's transaction store, user mapping, and session; Vite receives only a safe redirect helper and requires a backend.

Example request:

> Use `$compose-typescript-integrations` to add vendor-neutral OIDC SSO to this application.

### Paystack payments

The Paystack recipe includes a server client, precise subunit conversion, reference generation, verification assertions, raw-body webhook signature validation, and Next.js or Express route factories. It supports hosted checkout, Ghana mobile money, idempotent webhooks, and test-to-live guidance.

Example request:

> Use `$compose-typescript-integrations` to add Paystack mobile-money and card payments to this TypeScript application.

### Cloudflare R2 storage

The R2 recipe includes a lazy S3-compatible client, safe object-key generation, object operations, short-lived presigned URLs, browser upload, and authorization-aware Next.js or Express route factories. Vite receives only the browser uploader—never server credentials.

Example request:

> Use `$compose-typescript-integrations` to add private Cloudflare R2 uploads to this Next.js application.

### Mapbox location and search

The Mapbox recipe includes a client-only React location picker with Search Box, a live map, selected-place marker, Ghana defaults, and an explicit longitude/latitude result contract.

Example request:

> Use `$compose-typescript-integrations` to add Ghana-biased place search and a selectable map to this React application.

### Google Maps and Places

The Google Maps recipe uses the official loader, modern Places autocomplete, a map and advanced marker, Ghana defaults, and the same explicit place/longitude/latitude contract as the Mapbox facade.

Example request:

> Use `$compose-typescript-integrations` to add Google Maps place search and a selectable map to this React application.

### Provider-neutral routing and ETA

The routing recipe provides a stable server interface over Google Routes or Mapbox Navigation for a single traffic-aware route and origin×destination matrices. It returns WGS84-safe distance, expected duration, provider baseline duration when available, traffic status, and route geometry without exposing provider credentials to the browser.

Example request:

> Use `$compose-typescript-integrations` to set up and verify traffic-aware routing and ETA here.

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
- Transactional email and notifications
