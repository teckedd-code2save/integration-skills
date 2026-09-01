# Clerk authentication recipe

Use this recipe when the user wants Clerk authentication in a TypeScript application, including Google, LinkedIn, or Telegram login through one Clerk session system. Clerk maintains its own CLI and agent skills, so compose those upstream tools instead of maintaining duplicate framework snippets here.

## Completion contract for agents

When the user asks to set up, integrate, configure, repair, migrate, or finish Clerk, own the result from existing-auth discovery through verification. A one-line request is sufficient.

1. Inspect the current session, user, role, middleware, protected-route, and account-recovery paths. If another auth system exists, identify how existing identities and authorization data will map before replacing it.
2. Use Clerk's maintained CLI, skills, connector, or authenticated dashboard to create or link one application and enable only the requested methods.
3. Store keys in the correct browser/server environments without revealing secrets, and ensure every participating frontend and backend points to the same Clerk instance.
4. Connect Clerk to the application's real user and authorization model. Do not stop at generated sign-in pages or provider wrappers.
5. Exercise each requested login method, one signed-out rejection, server-side identity and authorization, sign-out, and the repository's checks.

Clerk is complete only when each requested authentication method works against the intended instance and a real protected application path enforces it. Package installation, generated pages, configured variable names, or a successful login alone do not prove authorization or migration. Ask the user only for login, MFA, production OAuth credentials, consent, or another genuinely human account action, then continue.

Authoritative sources:

- Clerk CLI: https://clerk.com/docs/cli
- Clerk agent skills: https://clerk.com/docs/guides/ai/skills
- Clerk skills repository: https://github.com/clerk/skills
- Environment variables: https://clerk.com/docs/guides/development/clerk-environment-variables
- Google social connection: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google
- LinkedIn OIDC connection: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/linkedin-oidc
- Custom OIDC social provider: https://clerk.com/docs/guides/configure/auth-strategies/social-connections/custom-provider
- Telegram OIDC login: https://core.telegram.org/bots/telegram-login

## Compose requested social methods

Use method facets so the manifest records the intended login methods and later agents receive their setup and verification gates:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose google-auth linkedin-auth telegram-auth --target . --install
```

These facets automatically add `clerk`; they do not add competing session systems. Google and LinkedIn use Clerk's maintained social connections. Configure Telegram as a custom OIDC provider using `https://oauth.telegram.org/.well-known/openid-configuration`, Authorization Code flow, and PKCE. Register the exact URLs with BotFather and map claims deliberately. Telegram may not supply the same verified email identity as another provider, so test the account-linking policy instead of assuming email-based linking.

Use the separate `oidc` recipe when the application should own a portable OIDC flow rather than Clerk. The scaffolder rejects composing both authorities into one target.

## Inspect first

Determine:

- Framework and version, especially Next.js version and App Router versus Pages Router.
- Package manager and workspace structure.
- Whether authentication, session middleware, protected routes, or user tables already exist.
- Which methods the user requested: Google or another social connection, email, phone, passkeys, organizations, or only basic sign-in.
- The application's existing environment and deployment-secret conventions.

If authentication already exists, describe the overlap and migration impact before replacing it.

## Use Clerk's maintained setup

Inspect the target, then scaffold the matching code starter:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add clerk --target . --install
```

For Next.js this creates the version-appropriate `proxy.ts` or `middleware.ts`, provider wrapper, account controls, sign-in/sign-up routes, and protected API example. For Vite + React it creates the provider and account controls with `VITE_CLERK_PUBLISHABLE_KEY`. For Express it creates `clerkAuthMiddleware`, `requireClerkAuth`, and `getAuthenticatedUserId`; mount the middleware before routes and reconcile it deliberately with existing JWT/session middleware. It preserves existing files.

The starter covers application code; authentication methods remain instance configuration. Continue with Clerk's maintained CLI or Dashboard for Google, phone OTP, and other requested methods.

Prefer Clerk's official tooling:

```bash
npx skills add clerk/skills --skill clerk-setup
npx skills add clerk/skills --skill clerk-cli
npx clerk auth login
npx clerk init
```

Only install agent skills when the current agent supports the Skills format. If the provider CLI is already installed, use it instead of adding another copy. Before using a CLI option not shown here, inspect the installed command's `--help`; do not guess flags.

`clerk init` can detect supported frameworks, install the appropriate SDK, scaffold auth pages and middleware, link a Clerk application, and retrieve environment variables. Let it perform supported scaffolding, then inspect the diff and adapt it to the repository. For frameworks it cannot fully scaffold, use the official `clerk-setup` skill and current framework documentation.

## Lead account and method configuration

If the user is not authenticated, start `npx clerk auth login` and let them complete browser login and MFA. Use the CLI to create or link an application when supported. Do not request credentials in chat.

For requested authentication methods:

- Use Clerk configuration commands when the installed CLI exposes the required operation. Inspect `npx clerk config --help` first.
- Otherwise open or direct the user to the exact Clerk Dashboard area.
- Social connections are configured under **SSO connections**. Development instances may use Clerk's shared OAuth credentials; production normally requires the provider's custom credentials and redirect URI.
- Phone, email, password, passkey, and MFA choices are configured under the instance's sign-up/sign-in options or corresponding authentication settings.
- Do not enable additional login methods merely because Clerk supports them.

When a connector or browser session is available, use it to navigate and fill non-sensitive configuration. Pause for passwords, MFA, legal acceptance, or any secret that should be entered by the user.

## Handle keys correctly

For Next.js, Clerk uses:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

Vite + React uses only `VITE_CLERK_PUBLISHABLE_KEY` in the browser. Express uses `CLERK_PUBLISHABLE_KEY` and server-only `CLERK_SECRET_KEY`. The frontend and backend must point to the same Clerk application.

The publishable key may be exposed to the browser. `CLERK_SECRET_KEY` must remain server-side and must never use a public environment-variable prefix. Prefer `npx clerk env pull` or a connected deployment integration over copying values through chat. Confirm that local secret files are ignored by version control.

## Refine the generated integration

Check that the generated result:

- Wraps the application in the required Clerk provider without disturbing existing root providers.
- Uses the correct middleware or proxy filename for the detected Next.js version.
- Keeps sign-in and sign-up routes public.
- Protects only the routes the user intended.
- Performs server-side authorization for protected API routes; hiding client UI is not authorization.
- Fits the application's existing navigation and styling rather than leaving an unrelated demo header.
- Avoids unnecessary user-data duplication. Add webhooks only when the application genuinely needs a local user projection.

## Verify

Run:

```bash
npx clerk doctor
```

Then run the project's existing typecheck, lint, tests, and build. When a local runtime is available, verify:

1. A public page remains reachable while signed out.
2. Sign-up or sign-in loads and completes with one requested method.
3. A protected page or API rejects a signed-out request.
4. The authenticated user or session is available on the server.
5. Sign-out removes access to the protected path.

Do not claim a social, phone, passkey, or production flow works unless that exact flow was exercised or clearly report it as awaiting user/provider verification.
