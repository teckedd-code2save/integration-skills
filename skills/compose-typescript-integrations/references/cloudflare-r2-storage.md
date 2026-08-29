# Cloudflare R2 storage recipe

Use this recipe when adding Cloudflare R2 object storage to a TypeScript application. Start with one private bucket and the smallest access surface that supports the product.

Authoritative sources:

- R2 API choices: https://developers.cloudflare.com/r2/api/
- S3-compatible setup: https://developers.cloudflare.com/r2/get-started/s3/
- Workers API: https://developers.cloudflare.com/r2/get-started/workers-api/
- R2 API tokens: https://developers.cloudflare.com/r2/api/tokens/
- AWS SDK v3 example: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- Presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Temporary credentials: https://developers.cloudflare.com/r2/api/s3/temporary-credentials/

## Inspect and choose the access mode

Determine the runtime, deployment target, existing storage abstraction, expected file sizes, upload frequency, whether objects are public or private, and who may upload or download them.

Choose one mode:

- **Cloudflare Worker in the same account:** prefer an R2 binding. It avoids S3 credentials and provides direct Workers API access.
- **Node.js, Next.js server, VPS, or another cloud:** use R2's S3-compatible API through `@aws-sdk/client-s3`.
- **Browser or mobile direct uploads/downloads:** issue short-lived presigned URLs from a trusted server. Never put permanent R2 credentials in the client.

Do not add both a Worker binding and an S3 client unless the application genuinely runs in both environments.

## Lead account and bucket setup

When Wrangler is appropriate, use the provider-owned login flow and let the user complete browser login and MFA:

```bash
npx wrangler login
npx wrangler r2 bucket create <bucket-name>
```

Inspect `npx wrangler r2 bucket --help` before using additional flags. Reuse an existing bucket when the user identifies one; do not create duplicates merely because creation is easy.

For an R2 binding, add the bucket to the existing `wrangler.jsonc` or `wrangler.toml` without replacing unrelated bindings. Use a valid TypeScript identifier for the binding and run `npx wrangler types` when the project uses generated Worker environment types.

For S3-compatible access, guide the user through **Cloudflare Dashboard → Storage & databases → R2 → Overview → Manage API Tokens**. Create a token scoped to the specific bucket with only the needed object permissions. The secret is shown once; have the user place it directly into a secure field or secret store, never into chat.

Use the application's established secret names when they already exist. Otherwise use:

```dotenv
CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

All four values are server-side configuration. Do not prefix credentials with `NEXT_PUBLIC_`, `VITE_`, or another client-exposed prefix.

## Copy-ready Node/VPS adapter

For a Next.js App Router project, install the executable starter:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs add r2 --target . --install
```

It creates the S3-compatible client, object helpers, a browser upload helper, and authorization-aware route factories. Compose a route using the application's real session and ownership rules:

```ts
import { createR2UploadRoute } from "@/integrations/r2/next-routes";

export const POST = createR2UploadRoute({
  allowedContentTypes: new Set(["image/jpeg", "image/png", "application/pdf"]),
  async authorize(request) {
    const user = await requireCurrentUser(request);
    const { contentType, extension } = await request.json();
    return { ownerId: user.id, contentType, extension };
  },
});
```

The route generates the object key on the server and limits presigned URLs to five minutes. Add product-specific size and purpose checks before issuing a URL, and persist the returned key against its owner after upload confirmation.

Install only the packages required by the chosen operations:

```bash
npm install @aws-sdk/client-s3
npm install @aws-sdk/s3-request-presigner
```

The presigner package is optional when uploads and downloads always pass through the server.

```ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${required("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

const bucket = () => required("R2_BUCKET");

export function putObject(input: {
  key: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
}) {
  return r2.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  }));
}

export function headObject(key: string) {
  return r2.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}

export function deleteObject(key: string) {
  return r2.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export function createUploadUrl(key: string, contentType: string, expiresIn = 300) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export function createDownloadUrl(key: string, expiresIn = 300) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}
```

Adapt the exported functions to the repository's storage interface rather than spreading S3-specific calls throughout business code.

## Build a safe upload flow

For presigned uploads:

1. Authenticate and authorize the requester on the server.
2. Validate the declared file type, purpose, and allowed size before issuing a URL.
3. Generate the object key on the server. Use an unpredictable identifier and a trusted extension; never use an untrusted filename as the storage path.
4. Sign only the required operation and keep expiry short. Cloudflare supports presigned expiry from 1 second through 7 days; use minutes for ordinary uploads.
5. Configure R2 CORS only for the exact web origins, methods, and headers the client needs.
6. After upload, confirm the object with `HEAD` and persist metadata such as owner, purpose, key, size, type, and status in the application database.
7. Serve private objects through short-lived download URLs or an authorized server route.

Do not rely only on a browser-provided MIME type. Scan or transform untrusted files when the product's risk requires it. Avoid making the bucket public by default. If the product needs public assets, prefer a deliberate public custom domain and separate public/private buckets when their policies differ.

For large files, use R2 multipart upload rather than buffering the entire object in application memory. Do not add multipart complexity to ordinary images or small documents.

## Worker binding variant

When the application runs as a Cloudflare Worker, configure a binding instead of credentials:

```jsonc
{
  "r2_buckets": [
    {
      "binding": "UPLOADS",
      "bucket_name": "my-uploads"
    }
  ]
}
```

Access it through the generated environment type as an `R2Bucket`. Preserve other Wrangler configuration. Remember that ordinary local `wrangler dev` storage is local unless remote behavior is explicitly requested.

## Verify

Run the project's typecheck, lint, tests, and build. Then use a unique test prefix and verify:

1. An authorized server request uploads a small known object.
2. `HEAD` returns the expected content type and length.
3. An authorized download returns identical bytes.
4. An unauthorized user cannot request an upload or download URL for another user's object.
5. A presigned URL expires and permits only its intended operation.
6. The browser can upload from the intended origin without broad CORS permissions.
7. The test object can be deleted and no unrelated object is affected.

Delete only the uniquely named test object after verification. Report whether the test used local Worker storage, a real R2 test bucket, or production configuration; do not treat local emulation as proof of live access.
