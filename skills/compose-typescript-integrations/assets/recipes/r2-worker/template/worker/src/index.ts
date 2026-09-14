interface Env {
  STORAGE: R2Bucket;
  APP_API_ORIGIN: string;
  APP_BROWSER_ORIGIN: string;
  MAX_UPLOAD_BYTES?: string;
  ALLOWED_CONTENT_TYPES?: string;
}

type Operation = "put" | "get" | "head";

type Authorization = {
  storageKey?: string;
  contentType?: string;
  contentLength?: number;
  completionToken?: string;
};

type AuthorizationResult =
  | { ok: true; value: Authorization & { storageKey: string } }
  | { ok: false; status: number };

const OBJECT_PATH = /^\/objects\/([^/]+)$/;
const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function corsHeaders(request: Request, env: Env) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (request.headers.get("Origin") === env.APP_BROWSER_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", env.APP_BROWSER_ORIGIN);
  }
  return headers;
}

function jsonError(request: Request, env: Env, status: number, error: string) {
  return Response.json({ error }, { status, headers: corsHeaders(request, env) });
}

function apiUrl(env: Env, path: string) {
  const origin = new URL(env.APP_API_ORIGIN);
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new Error("APP_API_ORIGIN must use HTTPS outside local development");
  }
  return new URL(path, origin);
}

function validStorageKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !value.startsWith("/");
}

async function authorize(
  request: Request,
  env: Env,
  fetcher: typeof fetch,
  objectId: string,
  operation: Operation,
  upload?: { contentType: string; contentLength: number },
): Promise<AuthorizationResult> {
  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith("Bearer ")) return { ok: false, status: 401 };
  const response = await fetcher(apiUrl(env, "/api/storage/edge/authorize"), {
    method: "POST",
    headers: {
      Authorization: bearer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ objectId, operation, ...upload }),
  });
  if (!response.ok) {
    return {
      ok: false,
      status: [401, 403, 404, 409, 410, 413].includes(response.status) ? response.status : 502,
    };
  }
  const value = await response.json() as Authorization;
  if (!validStorageKey(value.storageKey)) return { ok: false, status: 502 };
  return { ok: true, value: { ...value, storageKey: value.storageKey } };
}

async function completeUpload(
  env: Env,
  fetcher: typeof fetch,
  input: {
    objectId: string;
    storageKey: string;
    completionToken: string;
    etag: string;
    size: number;
  },
) {
  return fetcher(apiUrl(env, "/api/storage/edge/complete"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.completionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      objectId: input.objectId,
      operation: "put",
      storageKey: input.storageKey,
      etag: input.etag,
      size: input.size,
    }),
  });
}

function allowedTypes(env: Env) {
  const configured = env.ALLOWED_CONTENT_TYPES?.split(",").map((value) => value.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_TYPES);
}

async function putObject(
  request: Request,
  env: Env,
  fetcher: typeof fetch,
  objectId: string,
) {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim();
  const contentLength = Number(request.headers.get("Content-Length"));
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 33_554_432);
  if (!contentType || !allowedTypes(env).has(contentType)) {
    return jsonError(request, env, 415, "Unsupported object type");
  }
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > maxBytes) {
    return jsonError(request, env, 413, "Object length is missing or exceeds the upload limit");
  }
  if (!request.body) return jsonError(request, env, 400, "Object body required");

  const authorization = await authorize(
    request,
    env,
    fetcher,
    objectId,
    "put",
    { contentType, contentLength },
  );
  if (!authorization.ok) {
    return jsonError(request, env, authorization.status, "Upload is not authorized");
  }
  const approved = authorization.value;
  if (
    approved.contentType !== contentType ||
    approved.contentLength !== contentLength ||
    !approved.completionToken
  ) {
    return jsonError(request, env, 502, "Upload authorization is malformed");
  }

  const object = await env.STORAGE.put(approved.storageKey, request.body, {
    httpMetadata: { contentType },
    customMetadata: { objectId },
  });
  if (object.size !== contentLength) {
    await env.STORAGE.delete(approved.storageKey);
    return jsonError(request, env, 400, "Uploaded byte length did not match authorization");
  }
  const completion = await completeUpload(env, fetcher, {
    objectId,
    storageKey: approved.storageKey,
    completionToken: approved.completionToken,
    etag: object.httpEtag,
    size: object.size,
  });
  if (!completion.ok) {
    await env.STORAGE.delete(approved.storageKey);
    return jsonError(request, env, 502, "Upload could not be confirmed");
  }

  const headers = corsHeaders(request, env);
  headers.set("ETag", object.httpEtag);
  return Response.json({ objectId, status: "uploaded" }, { status: 201, headers });
}

async function getObject(
  request: Request,
  env: Env,
  fetcher: typeof fetch,
  objectId: string,
) {
  const operation = request.method.toLowerCase() as "get" | "head";
  const authorization = await authorize(request, env, fetcher, objectId, operation);
  if (!authorization.ok) {
    return jsonError(request, env, authorization.status, "Object access is not authorized");
  }
  const object = operation === "head"
    ? await env.STORAGE.head(authorization.value.storageKey)
    : await env.STORAGE.get(authorization.value.storageKey, {
      onlyIf: request.headers,
      range: request.headers,
    });
  if (!object) return jsonError(request, env, 404, "Object not found");

  const headers = corsHeaders(request, env);
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  if ("size" in object) headers.set("Content-Length", String(object.size));
  const hasBody = "body" in object;
  return new Response(hasBody ? (object as R2ObjectBody).body : null, {
    status: hasBody || operation === "head" ? 200 : 412,
    headers,
  });
}

export async function handleRequest(
  request: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return Response.json({ status: "ok", storage: "r2-binding" }, {
      headers: corsHeaders(request, env),
    });
  }
  if (request.method === "OPTIONS") {
    const headers = corsHeaders(request, env);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, PUT, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Range, If-None-Match");
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers });
  }
  const match = url.pathname.match(OBJECT_PATH);
  if (!match) return jsonError(request, env, 404, "Storage route not found");
  let objectId: string;
  try {
    objectId = decodeURIComponent(match[1]);
  } catch {
    return jsonError(request, env, 400, "Invalid object route");
  }
  if (request.method === "PUT") return putObject(request, env, fetcher, objectId);
  if (request.method === "GET" || request.method === "HEAD") {
    return getObject(request, env, fetcher, objectId);
  }
  return jsonError(request, env, 405, "Method not allowed");
}

export default {
  fetch(request: Request, env: Env) {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
