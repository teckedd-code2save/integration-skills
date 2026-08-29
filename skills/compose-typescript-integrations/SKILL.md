---
name: compose-typescript-integrations
description: Compose maintained third-party capabilities into existing TypeScript applications. Use when adding or configuring authentication, payments, storage, location, messaging, or similar product integrations; currently covers Clerk, Paystack, Cloudflare R2, and Mapbox.
---

# Compose TypeScript Integrations

Add the requested capability to the existing application by composing the provider's maintained SDK, CLI, agent skill, and documentation. Prefer upstream automation over copied snippets, then inspect and refine the result to fit the repository.

## Route the request

1. Inspect the project before changing it: framework and version, package manager, routing model, existing authentication or provider code, environment-file conventions, and available tests.
2. Preserve explicit user choices. Do not ask the user to select a provider, login method, or scope they already specified.
3. If the application is not TypeScript-based, explain that this version of the skill does not yet cover it rather than improvising an unsupported integration.
4. Read only the recipe for the selected provider:
   - Clerk authentication: [references/clerk-auth.md](references/clerk-auth.md)
   - Paystack payments: [references/paystack-payments.md](references/paystack-payments.md)
   - Cloudflare R2 storage: [references/cloudflare-r2-storage.md](references/cloudflare-r2-storage.md)
   - Mapbox location and search: [references/mapbox-location-search.md](references/mapbox-location-search.md)

## Compose safely

- Prefer official provider skills, CLIs, SDKs, and docs. Do not fork or restate a maintained upstream integration unless adaptation is actually needed.
- Use an authenticated connector or provider CLI when available to create or configure resources. Otherwise guide the user to the exact screen and resume after the necessary human step.
- Never ask the user to paste secret keys into chat. Put secrets into the project's established local secret file or connected deployment secret store, and ensure they are ignored by version control.
- Treat account login, MFA, billing acceptance, production promotion, and other human-only decisions as user steps. Continue useful local work while waiting when possible.
- Do not replace an existing auth or integration system without making the migration explicit.
- Inspect generated changes before accepting them. Refine imports, routes, middleware, styling, error handling, and configuration to match the existing project.

## Finish with evidence

Run the provider's diagnostic command when one exists, plus the project's relevant typecheck, lint, tests, and build. Exercise one public path, one successful integrated path, and one protected or failure path where practical. Report what was configured, what was verified, and any remaining dashboard or production action.
