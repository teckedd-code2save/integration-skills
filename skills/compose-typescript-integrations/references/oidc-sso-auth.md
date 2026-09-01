# Vendor-neutral OIDC and SSO recipe

Use this recipe when the application should support standards-based single sign-on without making Clerk its session authority. It works with conforming providers such as Keycloak, Authentik, Okta, Microsoft Entra ID, Google, or Telegram when the provider exposes suitable OpenID Connect discovery.

## Completion contract for agents

1. Inspect the existing user, session, role, protected-route, callback, and sign-out paths. Do not add a second auth authority beside Clerk or another existing system without an explicit migration.
2. Register one confidential web client with the exact callback URI. Configure the issuer URL, client ID, server-only client secret, callback, and minimal scopes through the repository's secure environment flow.
3. Compose the starter and implement its application-supplied transaction store. State, nonce, and PKCE verifier must be encrypted or server-side, short-lived, bound to the browser, and consumed once.
4. Map the verified `(issuer, subject)` pair to the application's user and authorization model and establish the application's secure session. Email is an attribute, not a stable cross-provider primary key.
5. Test sign-in, a real protected path, sign-out, missing/expired/altered/replayed transactions, provider errors, and project checks.

OIDC is complete only when the real application session and authorization path work. Discovery, a redirect, token receipt, or generated route files alone are not completion.

Authoritative sources:

- OpenID Connect Core: https://openid.net/specs/openid-connect-core-1_0.html
- OpenID Connect Discovery: https://openid.net/specs/openid-connect-discovery-1_0.html
- openid-client: https://github.com/panva/openid-client
- OAuth browser-based app security: https://www.rfc-editor.org/rfc/rfc9700

## Compose the portable server boundary

For Next.js App Router or Express TypeScript:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose oidc --target . --install
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup oidc --target .
```

The starter uses discovery, Authorization Code flow, S256 PKCE, state, nonce, and validated ID-token claims. It requires Node.js 20+; Express builds should use ESM/NodeNext because maintained `openid-client` v6 is ESM. It deliberately does not invent session storage: implement `saveTransaction`, `takeTransaction`, and `establishSession` using the application's established database, encrypted cookie/session library, and user model. Never serialize the client secret or verifier into browser-readable state.

A Vite target receives only `beginOidcSignIn`; the trusted backend must own discovery, the callback exchange, and sessions. Compose `oidc` into that server workspace separately.

Use `(issuer, subject)` as the external identity key. Verify the email claim before using it for contact or a deliberate account-linking workflow. Map group or role claims only from the intended issuer and apply least privilege.
