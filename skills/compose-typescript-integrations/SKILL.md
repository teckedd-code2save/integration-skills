---
name: compose-typescript-integrations
description: Compose maintained third-party capabilities into existing TypeScript applications. Use when adding or configuring authentication, SSO, payments, storage, maps, routing/ETA, or similar integrations; covers managed and vendor-neutral auth, Paystack, R2, Mapbox, Google Maps, and provider-neutral routing.
---

# Compose TypeScript Integrations

Add the requested capability to the existing application by composing the provider's maintained SDK, CLI, agent skill, and documentation. Use the bundled executable starters for Next.js App Router, Vite + React, and Express TypeScript applications, then refine them to fit the repository.

## Own short outcome requests

Treat instructions such as "set up R2", "add Clerk", or "finish Paystack" as requests to carry the integration from repository inspection through working verification. The user should not need to restate the workflow contained in this skill or its provider recipe.

- Execute the inspection, implementation, adaptation, dependency installation, configuration checks, tests, and diagnostics yourself.
- Use existing provider code as a starting point, not as evidence of completion. Prefer adapting the application's existing abstraction over adding a parallel implementation.
- Use an available authenticated connector or provider CLI for account resources and deployment configuration. Ask the user only for an irreducibly human action such as login, MFA, billing acceptance, or entering a one-time secret directly into a secure field.
- When a human action blocks progress, state the single exact action required and resume the workflow afterward. Do not turn the remaining agent work into instructions for the user.
- Do not report the integration as complete until the provider-specific completion gate passes. If access prevents the gate, report it as blocked rather than complete.

## Choose the setup mode once

Before the first setup action, read `integrations.config.json`. If `executionMode` is absent, ask whether the user wants **Auto (recommended)** or **Interactive** setup using the exact short choice in [references/setup-modes.md](references/setup-modes.md). Pass the answer to `compose` with `--mode auto` or `--mode interactive`; the manifest persists it for every integration and later agent. Do not ask again when a valid mode is already recorded unless the user asks to change it.

- In Auto mode, perform all safe agent-capable work and pause only for required access, login/MFA, approval, secure secret entry, billing/legal/paid commitments, production promotion, or destructive actions.
- In Interactive mode, inspect locally, then walk through external/account configuration and ask before each external mutation or consequential choice.
- In both modes, request the exact missing access or approval at the point it is needed, use the connector or official CLI after it is granted, and resume the workflow. A mode never grants additional authority or permits secrets in chat.

Apply this contract to every provider recipe, not only maps or routing. Read [references/setup-modes.md](references/setup-modes.md) for the full action boundaries and command behavior.

Persist a secret sink whenever the deployment target is known. Use `--secret-sink groundcontrol` for a GroundControl deployment, `infisical` for a direct Infisical runtime, `runtime-env` for another deployment platform's established secure environment, or `dotenv-local` only for local development. The generated `integrations.secrets.json` contains requirements and classifications but never values. Read [references/secret-sinks.md](references/secret-sinks.md) for the handoff contract.

## Route the request

1. Inspect the project before changing it: framework and version, package manager, routing model, existing authentication or provider code, environment-file conventions, and available tests.
2. Preserve explicit user choices. Do not ask the user to select a provider, login method, or scope they already specified.
3. If the application is not TypeScript-based, explain that this version of the skill does not yet cover it rather than improvising an unsupported integration.
4. Read only the recipe for the selected provider:
   - Clerk and Clerk-backed Google, LinkedIn, or Telegram authentication: [references/clerk-auth.md](references/clerk-auth.md)
   - Vendor-neutral OIDC/SSO authentication: [references/oidc-sso-auth.md](references/oidc-sso-auth.md)
   - Paystack payments: [references/paystack-payments.md](references/paystack-payments.md)
   - Cloudflare R2 storage: [references/cloudflare-r2-storage.md](references/cloudflare-r2-storage.md)
   - Mapbox location and search: [references/mapbox-location-search.md](references/mapbox-location-search.md)
   - Google Maps and Places: [references/google-maps-location.md](references/google-maps-location.md)
   - Provider-neutral routing and ETA: [references/routing-eta.md](references/routing-eta.md)

## Use the executable starters

Inspect the target first. At a workspace root, this lists the application workspaces; at an application target, it reports the framework and package-level signals for integrations that may already exist:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs inspect --target .
```

Run `compose` against one application target. In a monorepo, run it separately against the web and server workspaces. It records the selected providers in each target's `integrations.config.json`, installs the matching starters, and generates stable application-owned facades:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose <clerk|google-auth|linkedin-auth|telegram-auth|oidc|paystack|r2|mapbox|google-maps|routing-eta>... --target . --mode <auto|interactive> --secret-sink <runtime-env|groundcontrol|infisical|dotenv-local> --install
```

Subsequent agents can reproduce or repair the declared composition without restating providers:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose --target . --install
```

Web compositions generate `integrations/capabilities.ts`, `integrations/provider.tsx`, and capability-scoped client facades under `integrations/client/`. Server compositions generate `integrations/capabilities.ts` and `integrations/server.ts`. Use the stable facades in application code; use provider modules directly only when the facade does not expose a required advanced operation. Wrap the existing React root or Next.js layout with `AppIntegrationsProvider` when the generated provider is used.

Use the lower-level `add` command when only provider modules are wanted without a manifest or shared facade:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add <clerk|google-auth|linkedin-auth|telegram-auth|oidc|paystack|r2|mapbox|google-maps|routing-eta> --target . --install
```

Use `list` to inspect available starters and `--dry-run` to preview. The script detects Next.js App Router, Vite + React, Express, and workspace roots. It uses `proxy.ts` for Next.js 16+ and `middleware.ts` for older supported versions, selects browser-safe versus server-only modules, adds only missing `.env.example` keys, and preserves existing files. Package-level signals are warnings, not proof: inspect existing provider code before composing. Composition facades carry a generated-file marker and can be safely refreshed; a same-named user-owned file is skipped. Do not use `--force` merely to avoid merging; inspect skipped files and integrate the relevant code deliberately.

After scaffolding—or when `inspect` reports existing provider evidence—trigger the guided setup and diagnostic flow. Do not treat an installed package, environment-variable name, or fallback mode as a completed integration:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup <provider>... --target .
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs doctor <provider>... --target .
```

`setup` reports missing configuration without printing secret values, returns a structured `secretHandoff`, and gives the exact connector/CLI/dashboard path. A configured value is represented only by its variable name and status. Inspect the existing call path, configuration, authorization, ownership, failure handling, and tests before choosing whether to reuse it behind the generated facade or replace it. For R2, run `doctor r2 --live` after configuration; it performs a temporary put/get/delete round trip and removes its probe object. For routing, `doctor routing-eta --live` makes one traffic-aware Accra route request and checks for a usable distance and duration without printing the credential.

If no setup mode has been persisted, `compose`, `setup`, and `doctor` stop with an instruction to ask the first-run Auto/Interactive question. Their JSON output includes the active global mode, behavior, persistence state, and actions that always require access or approval.

Every provider setup report separates `agentActions`, `humanActions`, and `completionCriteria`. Perform every agent action. Surface a human action only when it is actually blocked on the user; its presence in the report is not a reason to stop early.

The starters provide working provider boundaries, not product authorization or business rules. Connect their explicit callbacks to the application's authenticated user, order, ownership, and idempotency layers. Do not scaffold a browser-only provider into a server target or a server-only provider into a browser target; the command rejects those mismatches.

## Compose safely

- Prefer official provider skills, CLIs, SDKs, and docs. Do not fork or restate a maintained upstream integration unless adaptation is actually needed.
- Use an authenticated connector or provider CLI when available to create or configure resources. Otherwise guide the user to the exact screen and resume after the necessary human step.
- Never ask the user to paste secret keys into chat. Put secrets into the project's established local secret file or connected deployment secret store, and ensure they are ignored by version control.
- Never accept a secret through a CLI argument or generated manifest. Use the selected sink's write-only input and expose only a success receipt to the agent.
- Treat account login, MFA, billing acceptance, production promotion, and other human-only decisions as user steps. Continue useful local work while waiting when possible.
- Do not replace an existing auth or integration system without making the migration explicit.
- Inspect generated changes before accepting them. Refine imports, routes, middleware, styling, error handling, and configuration to match the existing project.
- Never leave a route factory connected to browser-supplied price, object ownership, or fulfillment decisions. Supply those values from trusted server-side application state.

## Finish with evidence

Run the bundled doctor and the provider's official diagnostic command when one exists, plus the project's relevant typecheck, lint, tests, and build. Exercise one public path, one successful integrated path, and one protected or failure path where practical. For an existing integration, include concrete probe evidence; package detection alone is never success. Report what was configured, what was verified, and any remaining dashboard or production action.
