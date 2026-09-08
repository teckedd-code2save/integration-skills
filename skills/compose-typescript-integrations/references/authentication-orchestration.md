# Lead authentication through verification

Read this before initiating account access, recovering a failed sign-in, or moving provider credentials into a deployment. `setup` and `doctor` expose an `authenticationPlan` pointing here. It is guidance, not evidence that an account is authenticated. Reuse the application's execution mode and any explicit authorization already given; do not restart consent questions after a user says they have completed the requested step.

## Separate the four boundaries

| Boundary | Evidence needed | What it does not prove |
| --- | --- | --- |
| Provider account/browser | Intended account and application are accessible in that browser | CLI, connector, or VPS access |
| Agent connector/CLI | Same execution environment can inspect the intended account/resource | Runtime credentials or application-user login |
| Deployment runtime | Intended component receives the required configuration and its provider probe works | Browser session or object ownership |
| Application user | Real browser login reaches a protected action; unauthorized access fails | Capture, processing, rendering, or overall product quality |

Signing into GitHub in another tab does not authenticate every terminal or expand a GitHub App installation. A Cloudflare dashboard session is not an R2 S3 credential. A Clerk management credential is not a user's browser session. Keep each boundary explicit in handoff notes.

## Start, wait, resume

1. Inspect existing connections and CLI status in the environment that will execute the operation. Identify the account, app/instance, repository/bucket, target environment and scope using non-secret metadata. Reuse matching access; request only missing access.
2. If a connector installation fails, distinguish installer/handoff failure from a provider rejection. Report the observed error. A failed installation is not an intentional user refusal. Do not repeatedly suggest the same broken installation. Use an available official CLI or authenticated browser path consistent with the user's instructions.
3. Initiate a supported OAuth/device flow yourself. Retain the live terminal/session handle, provider, working directory and expiry in transient working context. Present the current verification URL and short-lived user code only to the user completing this flow. Do not commit codes, callback URLs containing codes, tokens or browser-session data.
4. Keep the initiating process alive while the user completes login, MFA and consent. Follow its prompts so it actually polls. Poll at the provider's interval and honor slow-down/expiry responses. Avoid long blocking waits that prevent progress updates.
5. When the user says “done” or “logged in in another tab,” resume that process, then run an account/resource check from the same runtime. User confirmation means the human step is done, not that the CLI received authorization.
6. If the code expired or was rejected, end the stale attempt and start one fresh flow. Give the new URL/code; never resend the old code or keep multiple active attempts. For repeated failure with a fresh code, inspect the exact provider/runtime error before another attempt.
7. Continue resource configuration, secure credential delivery and application verification. Ask again only for a newly identified missing scope or human-only action, with the concrete reason.

Do not turn this into a custom OAuth client when the official tool already owns token exchange, storage and refresh. Do not extract existing tokens to make another tool appear authenticated.

## Cloudflare: account OAuth and credential-free R2 runtime

Check the project's installed Wrangler version and `npx wrangler login --help`, then `npx wrangler whoami`. Reuse a session with the intended account and permissions.

For a remote agent or a phone approving login, prefer the official device flow **when the installed version exposes it**:

```sh
npx wrangler login --device --browser=false
npx wrangler whoami
```

Cloudflare documents device flow from Wrangler 4.119.0. This is current guidance, not a claim that the earlier HouseTour run used this exact flag. Do not silently upgrade a pinned dependency just to obtain it. Otherwise `npx wrangler login` uses a callback listener; the browser must be able to reach that listener. Browser localhost and remote-agent localhost may be different machines. Use supported forwarding/topology or device flow; do not ask for OAuth callback codes in chat or expose the listener publicly as a workaround.

Choose storage architecture **before asking for R2 keys**:

- An existing Worker can access R2 using its injected binding.
- A VPS application can also send authorized media traffic through a small Worker with an R2 binding, as HouseTour does. This moves bytes off the VPS and avoids R2 S3 credentials in the application. Explain this architecture change before implementing it; preserve an established S3 design unless a change is warranted/authorized.
- Direct Node/S3 access still needs appropriate S3 credentials. Wrangler OAuth is not interchangeable with `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Do not derive, print or copy the CLI's OAuth token into them.

For the Worker route: inspect/reuse the bucket, configure its binding in Wrangler, deploy through the authenticated CLI or connected Cloudflare build integration, then store only the Worker origin in the application's runtime configuration. Authenticate uploads through real application ownership checks and short-lived, narrowly scoped capabilities. Preserve private reads. No shared upload password is needed merely because the data passes through an edge service.

The bundled `r2` starter and `doctor r2 --live` currently implement the **S3** path. They do not scaffold or verify the Worker-binding architecture. A missing S3 key in that report is not a reason to add keys to a working binding deployment. Adapt the existing Worker explicitly and run a binding-aware test instead: authorized application upload, exact-byte readback, unauthorized rejection and deletion of only the unique diagnostic object. State whether it was local emulation or a deployed binding.

## Clerk: management access, credentials and real user login

Use the installed CLI's help before choosing commands. Supported entry points include `npx clerk auth login`, linking the intended application, `npx clerk env pull`, and `npx clerk doctor`. Inspect an existing project before using `init`, which can change files. If the CLI cannot perform the required configuration, use the authenticated dashboard rather than inventing flags.

Keep frontend and backend on the same Clerk instance. A publishable key belongs in the browser configuration; a secret key only in the server components that need it. Deliver credentials with a supported provider-to-sink integration, CLI writing to an ignored protected file, or a trusted browser/clipboard transfer that does **not** return the value to the model. If the available tool can only reveal a secret in its output, stop at that transport boundary and request direct entry into the secure destination. Never ask for a pasted chat key.

When using GroundControl, the agent can configure the intended deployment environment and component mapping after account access is granted. Reuse the Vault or selected provider. Inspect a save receipt and run a probe in the receiving component; do not read back secrets or dump the environment. A local `doctor` cannot inspect remote Vault values, so “missing locally” is not evidence of a broken deployment.

Verify real browser registration/sign-in, a protected server operation and signed-out rejection. If a first-time social sign-in says the external account was not found, inspect the application's sign-up flow and account-linking policy. Let the user complete registration/consent, then retry the intended sign-in. Do not silently create duplicate users.

A backend-created session or API test user is a separate smoke test. Do not strip origin checks, invent reserved JWT claims, or weaken issuer/audience validation to make it substitute for browser verification. Diagnose the exact rejected claim and use a genuine browser-issued session for the end-to-end test. Clean up only explicitly created temporary test users/data.

## GitHub and GroundControl access

Prefer the connected GitHub App when it already has the target repository. Confirm installation coverage. If a task specifically needs local `gh`, check `gh auth status --hostname github.com`; initiate `gh auth login --hostname github.com --web` only when needed. Follow its terminal prompts and resume the same process after the user approves. Verify with a read-only request for the exact repository, not just an account homepage. Never use `gh auth token` or print credential files as a diagnostic.

Repository access and container-registry access are distinct. Reuse GroundControl's saved registry configuration for image pulls. A source checker using a stale legacy token can fail even when the GitHub App is connected. An image pull can fail because the managed registry configuration was not supplied. Identify which boundary failed before asking for a new token. Use a supported existing authenticated path, document any workaround, and do not claim that the underlying GroundControl code was repaired unless it was.

Generate application-owned random secrets (such as database passwords) programmatically into the chosen sink. This is different from obtaining provider-issued credentials, which requires provider authorization. Do not add failing secret-sync workflows or CI runs merely to distribute secrets already owned by the deployment platform.

## Handoff evidence

Record non-secret metadata only: provider, chosen access method, account/resource identity, execution environment, credential sink and component names, last verified operation/time, exact redacted failure category and next step. Mark untested boundaries as unverified. Do not persist tokens, codes, cookies, secret values, fingerprints or token-bearing URLs. Existing login does not imply perpetual access after a runtime is replaced.

If implementation must leave a requested capability disabled, explain the missing authorization boundary and user-visible effect before delivering it. Implement the missing ownership check where feasible; do not silently reduce the product scope.

## HouseTour evidence and limits

The [2026-09-06 verification record](https://github.com/teckedd-code2save/housetour-platform/blob/3f571baced94313d91746e3a72cd4f766313147c/docs/runbooks/deployment-verification-2026-09-06.md) records:

- Clerk application creation and direct credential delivery into GroundControl; generated database/session secrets; existing registry access reused.
- User-completed registration, Google sign-in, authenticated property creation and a real browser upload through the media Worker into private R2; exact-byte readback using the existing Cloudflare OAuth session.
- A backend-session workaround that failed origin-claim validation; validation was preserved and browser login was used instead.
- Separate GroundControl source-check/registry-path issues and documented workarounds, not repaired provider credentials.

The [media Worker](https://github.com/teckedd-code2save/housetour-platform/blob/3f571baced94313d91746e3a72cd4f766313147c/edge/media-worker/README.md) documents `edge/media-worker`, its R2 binding and ownership-authorized upload path. These records establish that flow, not the exact browser clicks or every CLI invocation. Do not present suggested recovery commands as a transcript of what ran.

On 2026-09-08 the user still reported no panorama or 3D capture after APK 0.2.1. Authentication/upload success does not establish native capture or reconstruction success; that defect remains open.

## Maintained sources

- [Wrangler login and identity](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [Wrangler device login availability](https://developers.cloudflare.com/changelog/post/2026-08-04-wrangler-login-device-flow/)
- [R2 Workers API](https://developers.cloudflare.com/r2/get-started/workers-api/)
- [GitHub CLI login](https://cli.github.com/manual/gh_auth_login)
- [Clerk CLI](https://clerk.com/docs/cli)
