# R2 Worker gateway

This Worker streams private objects through an R2 binding. The application keeps ownership and session decisions; the Worker never receives an R2 access key or secret.

## Contract

For each `PUT`, `GET`, or `HEAD /objects/:objectId`, the Worker forwards the caller's bearer token to:

```text
POST {APP_API_ORIGIN}/api/storage/edge/authorize
```

The application must authenticate the caller, authorize the requested `objectId` and operation, and return the trusted R2 `storageKey`. For uploads it must also return the exact `contentType`, `contentLength`, and a ten-minute, single-use `completionToken` bound to that object and caller.

After a successful R2 write, the Worker sends the token to:

```text
POST {APP_API_ORIGIN}/api/storage/edge/complete
```

The application verifies and consumes the token before marking the object ready. If completion fails, the Worker removes the object it just wrote.

Do not expose raw object-key routes, trust browser-supplied ownership, or make the bucket public merely to simplify delivery.

For Next.js, mount the generated factories in the two application routes:

```ts
// app/api/storage/edge/authorize/route.ts
import { createStorageAuthorizeRoute } from "@/integrations/server";

export const POST = createStorageAuthorizeRoute({
  async authorize(request, input) {
    const user = await authenticateBearer(request);
    const object = await findObjectOwnedBy(user.id, input.objectId);
    if (!object || !userCan(user, input.operation, object)) return null;
    return authorizeObjectOperation(user, object, input);
  },
});
```

```ts
// app/api/storage/edge/complete/route.ts
import { createStorageCompleteRoute } from "@/integrations/server";

export const POST = createStorageCompleteRoute({
  async complete(request, input) {
    await verifyAndConsumeCompletionToken(request, input);
    await markObjectReady(input.objectId, input.etag, input.size);
  },
});
```

Those application functions are intentionally not invented by the starter. Implement them with the project's actual auth library, database, ownership model, and a completion token that is short-lived, single-use, and bound to the expected user, object, type, and length. For Express, mount `createStorageAuthorizeHandler(...)` and `createStorageCompleteHandler(...)` at the same two paths after `express.json()`.

## Setup

1. Replace the Worker name, bucket name, API origin, and browser origin in `wrangler.jsonc`.
2. Run `npm install` and `npm test` in this directory.
3. Run `npx wrangler whoami`; if needed run `npx wrangler login` and complete OAuth/MFA.
4. Reuse the intended private bucket, or create it once with `npx wrangler r2 bucket create <bucket-name>`.
5. Run `npx wrangler types`, `npm run typecheck`, and `npm run deploy`.
6. Store the deployed HTTPS origin as `NEXT_PUBLIC_R2_WORKER_ORIGIN` for Next.js, `R2_WORKER_ORIGIN` for an Express-served client, or `VITE_R2_WORKER_ORIGIN` for Vite.

For continuous delivery, connect the repository to Cloudflare Workers Builds and use `edge/r2-worker` as the root directory. Cloudflare then owns deployment authorization; no Cloudflare API token is added to GitHub, GroundControl, the VPS, or the repository.

## Verification

Use a temporary object owned by a test user and verify an authorized upload, exact-byte readback, unauthorized rejection, and cleanup. `wrangler dev` uses local R2 by default; a local pass is not proof of the deployed binding. Configure a remote binding or test the deployed Worker when live R2 evidence is required.
