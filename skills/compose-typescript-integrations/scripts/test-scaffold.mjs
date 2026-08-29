#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "scaffold.mjs");
const fixture = mkdtempSync(join(resolve(), ".integration-kit-"));
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

const composed = run(
  "compose",
  "clerk",
  "paystack",
  "r2",
  "mapbox",
  "--target",
  fixture,
);
assert.equal(composed.composition.config.status, "created");
assert.ok(composed.composition.files.every((file) => file.status === "created"));
assert.deepEqual(readFileSync(join(fixture, "integrations.config.json"), "utf8"), `${JSON.stringify({
  managedBy: "compose-typescript-integrations",
  version: 1,
  integrations: ["clerk", "paystack", "r2", "mapbox"],
}, null, 2)}\n`);
assert.match(
  readFileSync(join(fixture, "src", "integrations", "server.ts"), "utf8"),
  /createPaymentInitializeRoute/,
);
assert.match(
  readFileSync(join(fixture, "src", "integrations", "client", "location.ts"), "utf8"),
  /LocationPicker/,
);
const replay = run("compose", "--target", fixture);
assert.equal(replay.composition.config.status, "unchanged");
assert.ok(replay.composition.files.every((file) => file.status === "unchanged"));

const serverFacadePath = join(fixture, "src", "integrations", "server.ts");
const generatedServerFacade = readFileSync(serverFacadePath, "utf8");
writeFileSync(serverFacadePath, "user-owned\n");
const compositionCollision = run("compose", "--target", fixture);
assert.deepEqual(
  compositionCollision.composition.files.filter((file) => file.status === "skipped"),
  [{ path: "src/integrations/server.ts", status: "skipped" }],
);
assert.equal(readFileSync(serverFacadePath, "utf8"), "user-owned\n");
writeFileSync(serverFacadePath, generatedServerFacade);

const paystackClientPath = join(fixture, "src", "integrations", "paystack", "client.ts");
const generatedPaystackClient = readFileSync(paystackClientPath, "utf8");
writeFileSync(paystackClientPath, "user-owned\n");
const collision = run("add", "paystack", "--target", fixture);
assert.deepEqual(collision.results[0].skipped, ["src/integrations/paystack/client.ts"]);
assert.equal(
  readFileSync(join(fixture, "src", "integrations", "paystack", "client.ts"), "utf8"),
  "user-owned\n",
);
writeFileSync(paystackClientPath, generatedPaystackClient);

const fixture15 = mkdtempSync(join(resolve(), ".integration-kit-next15-"));
mkdirSync(join(fixture15, "app"), { recursive: true });
writeFileSync(
  join(fixture15, "package.json"),
  JSON.stringify(
    {
      private: true,
      dependencies: { next: "^15.5.0", react: "19.1.0", "react-dom": "19.1.0" },
    },
    null,
    2,
  ),
);
const next15 = run("compose", "clerk", "--target", fixture15);
assert.equal(next15.framework, "nextjs-15-app-router");
assert.ok(existsSync(join(fixture15, "middleware.ts")));
assert.ok(!existsSync(join(fixture15, "proxy.ts")));
assert.ok(existsSync(join(fixture15, "integrations", "provider.tsx")));
const next15Install = run(
  "compose",
  "--target",
  fixture15,
  "--install",
  "--dry-run",
);
assert.ok(next15Install.dependencies.includes("react@~19.1.4"));
assert.ok(next15Install.dependencies.includes("react-dom@~19.1.4"));

writeFileSync(
  join(fixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "es2022"],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        types: ["node"],
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
    null,
    2,
  ),
);
execFileSync(resolve("node_modules", ".bin", "tsc"), ["--project", join(fixture, "tsconfig.json")], {
  stdio: "inherit",
});

rmSync(fixture, { recursive: true, force: true });
rmSync(fixture15, { recursive: true, force: true });
console.log("scaffolder and starter typecheck tests passed");
