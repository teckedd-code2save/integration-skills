#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "scaffold.mjs");
const fixture = mkdtempSync(join(tmpdir(), "integration-kit-"));
mkdirSync(join(fixture, "src", "app"), { recursive: true });
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({ private: true, dependencies: { next: "^16.0.0" } }, null, 2),
);

const run = (...args) =>
  JSON.parse(execFileSync(process.execPath, [script, ...args, "--json"], { encoding: "utf8" }));

const first = run("add", "clerk", "paystack", "r2", "mapbox", "--target", fixture);
assert.equal(first.framework, "nextjs-16-app-router");
assert.equal(first.results.length, 4);
assert.ok(existsSync(join(fixture, "src", "proxy.ts")));
assert.ok(existsSync(join(fixture, "src", "integrations", "paystack", "client.ts")));
assert.ok(existsSync(join(fixture, "src", "integrations", "r2", "client.ts")));
assert.ok(existsSync(join(fixture, "src", "components", "mapbox-location-picker.tsx")));

const env = readFileSync(join(fixture, ".env.example"), "utf8");
for (const name of [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "PAYSTACK_SECRET_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
]) {
  assert.match(env, new RegExp(`^${name}=$`, "m"));
}

const second = run("add", "clerk", "paystack", "r2", "mapbox", "--target", fixture);
assert.ok(second.results.every((result) => result.created.length === 0));
assert.ok(second.results.every((result) => result.skipped.length === 0));
assert.ok(second.results.every((result) => result.unchanged.length > 0));
assert.match(env, /^NEXT_PUBLIC_CLERK_SIGN_IN_URL=\/sign-in$/m);
assert.match(env, /^NEXT_PUBLIC_CLERK_SIGN_UP_URL=\/sign-up$/m);

writeFileSync(join(fixture, "src", "integrations", "paystack", "client.ts"), "user-owned\n");
const collision = run("add", "paystack", "--target", fixture);
assert.deepEqual(collision.results[0].skipped, ["src/integrations/paystack/client.ts"]);
assert.equal(
  readFileSync(join(fixture, "src", "integrations", "paystack", "client.ts"), "utf8"),
  "user-owned\n",
);

const fixture15 = mkdtempSync(join(tmpdir(), "integration-kit-next15-"));
mkdirSync(join(fixture15, "app"), { recursive: true });
writeFileSync(
  join(fixture15, "package.json"),
  JSON.stringify({ private: true, dependencies: { next: "^15.5.0" } }, null, 2),
);
const next15 = run("add", "clerk", "--target", fixture15);
assert.equal(next15.framework, "nextjs-15-app-router");
assert.ok(existsSync(join(fixture15, "middleware.ts")));
assert.ok(!existsSync(join(fixture15, "proxy.ts")));

console.log(`scaffolder tests passed: ${fixture}`);
