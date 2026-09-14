import assert from "node:assert/strict";
import test from "node:test";
import { handleRequest } from "../src/index";

function fixture() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string; etag: string }>();
  const completions: unknown[] = [];
  const storage = {
    async put(key: string, value: ReadableStream, options: { httpMetadata?: { contentType?: string } }) {
      const bytes = new Uint8Array(await new Response(value).arrayBuffer());
      const etag = `"${bytes.length}-fixture"`;
      objects.set(key, { bytes, contentType: options.httpMetadata?.contentType || "", etag });
      return { key, size: bytes.length, httpEtag: etag };
    },
    async get(key: string) {
      const value = objects.get(key);
      if (!value) return null;
      return {
        key,
        size: value.bytes.length,
        httpEtag: value.etag,
        body: new Response(value.bytes.buffer as ArrayBuffer).body,
        writeHttpMetadata(headers: Headers) {
          headers.set("Content-Type", value.contentType);
        },
      };
    },
    async head(key: string) {
      const value = objects.get(key);
      if (!value) return null;
      return {
        key,
        size: value.bytes.length,
        httpEtag: value.etag,
        writeHttpMetadata(headers: Headers) {
          headers.set("Content-Type", value.contentType);
        },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  } as unknown as R2Bucket;
  const env = {
    STORAGE: storage,
    APP_API_ORIGIN: "https://api.example.com",
    APP_BROWSER_ORIGIN: "https://app.example.com",
    MAX_UPLOAD_BYTES: "1024",
    ALLOWED_CONTENT_TYPES: "image/webp",
  };
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      if (new Headers(init?.headers).get("Authorization") !== "Bearer user-session") {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const body = JSON.parse(String(init?.body));
      return Response.json({
        storageKey: `owners/user-1/${body.objectId}.webp`,
        ...(body.operation === "put" ? {
          contentType: body.contentType,
          contentLength: body.contentLength,
          completionToken: "one-time-completion",
        } : {}),
      });
    }
    if (url.pathname.endsWith("/complete")) {
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer one-time-completion");
      completions.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected application callback ${url}`);
  };
  return { env, fetcher, objects, completions };
}

test("rejects object access without an application bearer token", async () => {
  const { env, fetcher } = fixture();
  const response = await handleRequest(
    new Request("https://media.example.com/objects/photo-1"),
    env,
    fetcher,
  );
  assert.equal(response.status, 401);
});

test("streams an authorized upload through R2 and confirms it", async () => {
  const { env, fetcher, objects, completions } = fixture();
  const body = "worker-bound-r2";
  const response = await handleRequest(
    new Request("https://media.example.com/objects/photo-1", {
      method: "PUT",
      headers: {
        Authorization: "Bearer user-session",
        "Content-Type": "image/webp",
        "Content-Length": String(body.length),
        Origin: "https://app.example.com",
      },
      body,
    }),
    env,
    fetcher,
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://app.example.com");
  assert.equal(objects.size, 1);
  assert.equal(completions.length, 1);

  const download = await handleRequest(
    new Request("https://media.example.com/objects/photo-1", {
      headers: { Authorization: "Bearer user-session" },
    }),
    env,
    fetcher,
  );
  assert.equal(download.status, 200);
  assert.equal(await download.text(), body);
});

test("removes the object when application completion fails", async () => {
  const { env, objects } = fixture();
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      const body = JSON.parse(String(init?.body));
      return Response.json({
        storageKey: "owners/user-1/failed.webp",
        contentType: body.contentType,
        contentLength: body.contentLength,
        completionToken: "one-time-completion",
      });
    }
    return Response.json({ error: "failed" }, { status: 500 });
  };
  const body = "cleanup";
  const response = await handleRequest(
    new Request("https://media.example.com/objects/photo-2", {
      method: "PUT",
      headers: {
        Authorization: "Bearer user-session",
        "Content-Type": "image/webp",
        "Content-Length": String(body.length),
      },
      body,
    }),
    env,
    fetcher,
  );
  assert.equal(response.status, 502);
  assert.equal(objects.size, 0);
});
