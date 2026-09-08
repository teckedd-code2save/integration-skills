#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "scaffold.mjs");
const tempFixture = (prefix) => {
  const path = mkdtempSync(join(tmpdir(), prefix));
  symlinkSync(resolve("node_modules"), join(path, "node_modules"), "dir");
  return path;
};
const fixture = tempFixture("integration-kit-");
mkdirSync(join(fixture, "src", "app"), { recursive: true });
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify({ private: true, dependencies: { next: "^16.0.0" } }, null, 2),
);

const runRaw = (...args) =>
  JSON.parse(execFileSync(process.execPath, [script, ...args, "--json"], { encoding: "utf8" }));
const run = (...args) => {
  const effectiveArgs = args[0] === "compose" && !args.includes("--mode")
    ? [...args, "--mode", "auto"]
    : args;
  return runRaw(...effectiveArgs);
};

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

assert.throws(
  () => runRaw("compose", "clerk", "--target", fixture),
  /ask the user to choose auto or interactive/,
);
assert.throws(
  () => runRaw("compose", "clerk", "--target", fixture, "--mode", "automatic"),
  /--mode must be auto or interactive/,
);

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
  executionMode: "auto",
  secretSink: "runtime-env",
  integrations: ["clerk", "paystack", "r2", "mapbox"],
}, null, 2)}\n`);
const defaultSecretPlan = JSON.parse(readFileSync(join(fixture, "integrations.secrets.json"), "utf8"));
assert.equal(defaultSecretPlan.sink, "runtime-env");
assert.equal(defaultSecretPlan.modelVisibility, "metadata-only");
assert.ok(defaultSecretPlan.requirements.some((entry) =>
  entry.integration === "r2" && entry.name === "R2_SECRET_ACCESS_KEY" && entry.kind === "secret"
));
assert.ok(defaultSecretPlan.requirements.every((entry) => !("value" in entry)));
assert.equal(composed.executionMode.value, "auto");
assert.equal(composed.executionMode.persisted, true);
assert.match(
  readFileSync(join(fixture, "src", "integrations", "server.ts"), "utf8"),
  /createPaymentInitializeRoute/,
);
assert.match(
  readFileSync(join(fixture, "src", "integrations", "client", "location.ts"), "utf8"),
  /LocationPicker/,
);
const replay = runRaw("compose", "--target", fixture);
assert.equal(replay.composition.config.status, "unchanged");
assert.ok(replay.composition.files.every((file) => file.status === "unchanged"));
assert.equal(replay.executionMode.value, "auto");

const interactiveSetup = runRaw("setup", "r2", "--target", fixture, "--mode", "interactive");
assert.equal(interactiveSetup.executionMode.value, "interactive");
assert.equal(interactiveSetup.executionMode.persisted, true);
assert.match(interactiveSetup.executionMode.behavior, /step by step/);
assert.ok(interactiveSetup.executionMode.alwaysAskFor.some((item) => /billing/.test(item)));
assert.equal(
  JSON.parse(readFileSync(join(fixture, "integrations.config.json"), "utf8")).executionMode,
  "interactive",
);
const interactiveReplay = runRaw("setup", "r2", "--target", fixture);
assert.equal(interactiveReplay.executionMode.value, "interactive");

const groundControlSetup = runRaw(
  "setup",
  "r2",
  "--target",
  fixture,
  "--secret-sink",
  "groundcontrol",
);
assert.equal(groundControlSetup.secretSink.id, "groundcontrol");
assert.equal(groundControlSetup.secretSink.persisted, true);
assert.equal(groundControlSetup.secretSink.modelVisibility, "metadata-only");
assert.equal(
  JSON.parse(readFileSync(join(fixture, "integrations.config.json"), "utf8")).secretSink,
  "groundcontrol",
);
assert.equal(
  JSON.parse(readFileSync(join(fixture, "integrations.secrets.json"), "utf8")).sink,
  "groundcontrol",
);
const r2SecretHandoff = groundControlSetup.integrations.find((entry) => entry.id === "r2").secretHandoff;
const r2AuthPlan = groundControlSetup.integrations.find((entry) => entry.id === "r2").authenticationPlan;
assert.equal(r2AuthPlan.status, "not-verified");
assert.equal(r2AuthPlan.authority, "cloudflare");
assert.equal(r2AuthPlan.credentialSink, "groundcontrol");
assert.equal(r2AuthPlan.starterAccess, "direct-s3-credentials");
assert.ok(r2AuthPlan.accessChoices.includes("worker-r2-binding"));
assert.ok(existsSync(resolve(dirname(script), "..", r2AuthPlan.reference)));
assert.equal(r2SecretHandoff.sink, "groundcontrol");
assert.equal(r2SecretHandoff.status, "secure-input-required");
assert.ok(r2SecretHandoff.requirements.some((entry) =>
  entry.name === "R2_SESSION_TOKEN" && entry.required === false && entry.kind === "secret"
));
assert.ok(!JSON.stringify(groundControlSetup).includes("secretAccessKey"));

const secretSentinel = "must-never-appear-in-a-setup-report";
process.env.R2_SECRET_ACCESS_KEY = secretSentinel;
try {
  const redactedSetup = runRaw("setup", "r2", "--target", fixture);
  assert.ok(redactedSetup.integrations[0].configured.includes("R2_SECRET_ACCESS_KEY"));
  assert.ok(!JSON.stringify(redactedSetup).includes(secretSentinel));
  assert.equal(redactedSetup.integrations[0].authenticationPlan.status, "not-verified");
} finally {
  delete process.env.R2_SECRET_ACCESS_KEY;
}

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

for (const id of [
  "clerk",
  "google-auth",
  "linkedin-auth",
  "telegram-auth",
  "oidc",
  "paystack",
  "r2",
  "mapbox",
  "google-maps",
  "routing-eta",
]) {
  const report = runRaw("setup", id, "--target", fixture);
  assert.equal(report.executionMode.value, "auto", `${id} should inherit the global setup mode`);
  assert.ok(report.integrations.some((integration) => integration.id === id));
  const plan = report.integrations.find((integration) => integration.id === id).authenticationPlan;
  assert.equal(plan.status, "not-verified");
  assert.equal(plan.credentialSink, report.secretSink.id);
  assert.ok(existsSync(resolve(dirname(script), "..", plan.reference)));
  if (["google-auth", "linkedin-auth", "telegram-auth"].includes(id)) assert.equal(plan.authority, "clerk");
}

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

const fixture15 = tempFixture("integration-kit-next15-");
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

const socialFixture = tempFixture("integration-kit-social-");
mkdirSync(join(socialFixture, "src", "app"), { recursive: true });
writeFileSync(
  join(socialFixture, "package.json"),
  JSON.stringify({ private: true, dependencies: { next: "^16.0.0" } }, null, 2),
);
const social = run(
  "compose",
  "google-auth",
  "linkedin-auth",
  "telegram-auth",
  "--target",
  socialFixture,
);
assert.deepEqual(
  social.results.map((result) => result.id),
  ["clerk", "google-auth", "linkedin-auth", "telegram-auth"],
);
assert.deepEqual(
  JSON.parse(readFileSync(join(socialFixture, "integrations.config.json"), "utf8")).integrations,
  ["clerk", "google-auth", "linkedin-auth", "telegram-auth"],
);

const installedFixture = tempFixture("integration-kit-existing-dependencies-");
mkdirSync(join(installedFixture, "app"), { recursive: true });
writeFileSync(
  join(installedFixture, "package.json"),
  JSON.stringify({
    private: true,
    dependencies: {
      next: "^16.0.0",
      react: "^19.2.5",
      "react-dom": "^19.2.5",
      "@aws-sdk/client-s3": "^3.1125.0",
      "@aws-sdk/s3-request-presigner": "^3.1125.0",
    },
  }, null, 2),
);
const packageBeforeInstall = readFileSync(join(installedFixture, "package.json"), "utf8");
const existingDependencies = run(
  "compose",
  "r2",
  "--target",
  installedFixture,
  "--mode",
  "auto",
  "--install",
);
assert.equal(existingDependencies.installed, "already present");
assert.equal(readFileSync(join(installedFixture, "package.json"), "utf8"), packageBeforeInstall);
assert.deepEqual(
  JSON.parse(
    readFileSync(join(socialFixture, "src", "integrations", "capabilities.ts"), "utf8")
      .match(/= (\{[\s\S]*\}) as const;/)[1],
  ).authMethods,
  ["google", "linkedin", "telegram"],
);
const socialSetup = run(
  "setup",
  "google-auth",
  "linkedin-auth",
  "telegram-auth",
  "--target",
  socialFixture,
);
assert.deepEqual(
  socialSetup.integrations.map((integration) => integration.status),
  ["setup-required", "provider-verification-required", "provider-verification-required", "provider-verification-required"],
);
assert.throws(
  () => run("compose", "clerk", "oidc", "--target", socialFixture),
  /choose one session authority/,
);

const workspaceFixture = tempFixture("integration-kit-workspace-");
writeFileSync(
  join(workspaceFixture, "package.json"),
  JSON.stringify({ private: true, packageManager: "pnpm@10.14.0" }, null, 2),
);
writeFileSync(join(workspaceFixture, "pnpm-workspace.yaml"), "packages:\n  - 'web'\n  - 'api'\n");
const workspaceInspection = run("inspect", "--target", workspaceFixture);
assert.equal(workspaceInspection.framework, "typescript-workspace-root");
assert.deepEqual(workspaceInspection.workspaces, ["web", "api"]);
assert.throws(
  () => run("compose", "clerk", "--target", workspaceFixture),
  /target is a workspace root/,
);

const viteFixture = tempFixture("integration-kit-vite-");
mkdirSync(join(viteFixture, "src"), { recursive: true });
writeFileSync(
  join(viteFixture, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: { vite: "^7.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
    },
    null,
    2,
  ),
);
const vite = run("compose", "clerk", "r2", "mapbox", "routing-eta", "--target", viteFixture);
assert.equal(vite.framework, "vite-react");
assert.ok(existsSync(join(viteFixture, "src", "integrations", "clerk", "provider.tsx")));
assert.ok(existsSync(join(viteFixture, "src", "components", "mapbox-location-picker.tsx")));
assert.ok(existsSync(join(viteFixture, "src", "integrations", "r2", "upload.ts")));
assert.ok(existsSync(join(viteFixture, "src", "integrations", "routing-eta", "browser.ts")));
assert.ok(!existsSync(join(viteFixture, "src", "integrations", "routing-eta", "client.ts")));
assert.match(
  readFileSync(join(viteFixture, ".env.example"), "utf8"),
  /^VITE_CLERK_PUBLISHABLE_KEY=$/m,
);
assert.match(
  readFileSync(join(viteFixture, ".env.example"), "utf8"),
  /^VITE_MAPBOX_ACCESS_TOKEN=$/m,
);
assert.throws(
  () => run("compose", "paystack", "--target", viteFixture),
  /does not have a vite-react starter/,
);
const viteSetup = run("setup", "clerk", "mapbox", "routing-eta", "--target", viteFixture);
assert.deepEqual(
  viteSetup.integrations.map((integration) => integration.status),
  ["setup-required", "setup-required", "backend-setup-required"],
);
assert.match(viteSetup.integrations[0].guide.dashboard, /clerk/);
for (const integration of viteSetup.integrations) {
  assert.ok(integration.guide.agentActions.length >= 4);
  assert.ok(integration.guide.humanActions.length >= 1);
  assert.ok(integration.guide.completionCriteria.length >= 3);
}
writeFileSync(
  join(viteFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ["vite/client"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(resolve("node_modules", ".bin", "tsc"), ["--project", join(viteFixture, "tsconfig.json")], {
  stdio: "inherit",
});

const googleMapsFixture = tempFixture("integration-kit-google-maps-");
mkdirSync(join(googleMapsFixture, "src"), { recursive: true });
writeFileSync(
  join(googleMapsFixture, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: { vite: "^8.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
    },
    null,
    2,
  ),
);
const googleMaps = run("compose", "google-maps", "--target", googleMapsFixture);
assert.equal(googleMaps.framework, "vite-react");
assert.ok(existsSync(join(googleMapsFixture, "src", "components", "google-maps-location-picker.tsx")));
assert.match(
  readFileSync(join(googleMapsFixture, ".env.example"), "utf8"),
  /^VITE_GOOGLE_MAPS_API_KEY=$/m,
);
assert.match(
  readFileSync(join(googleMapsFixture, "src", "integrations", "client", "location.ts"), "utf8"),
  /GoogleMapsLocationPicker as LocationPicker/,
);
assert.throws(
  () => run("compose", "mapbox", "google-maps", "--target", googleMapsFixture),
  /choose one location provider/,
);
writeFileSync(
  join(googleMapsFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ["vite/client", "google.maps"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(
  resolve("node_modules", ".bin", "tsc"),
  ["--project", join(googleMapsFixture, "tsconfig.json")],
  { stdio: "inherit" },
);

const routingFixture = tempFixture("integration-kit-routing-");
mkdirSync(join(routingFixture, "src", "app"), { recursive: true });
writeFileSync(
  join(routingFixture, "package.json"),
  JSON.stringify({ private: true, type: "module", dependencies: { next: "^16.0.0" } }, null, 2),
);
const routing = run("compose", "google-maps", "routing-eta", "--target", routingFixture);
assert.equal(routing.framework, "nextjs-16-app-router");
assert.ok(!routing.dependencies.includes(null));
assert.ok(existsSync(join(routingFixture, "src", "integrations", "routing-eta", "client.ts")));
assert.ok(existsSync(join(routingFixture, "src", "integrations", "routing-eta", "next-routes.ts")));
assert.match(
  readFileSync(join(routingFixture, "src", "integrations", "server.ts"), "utf8"),
  /createRouteMatrixRoute/,
);
assert.match(
  readFileSync(join(routingFixture, "src", "integrations", "client", "routing.ts"), "utf8"),
  /requestRouteEstimate/,
);
const routingEnv = readFileSync(join(routingFixture, ".env.example"), "utf8");
assert.match(routingEnv, /^ROUTING_PROVIDER=google$/m);
assert.match(routingEnv, /^GOOGLE_ROUTES_API_KEY=$/m);
assert.match(routingEnv, /^MAPBOX_ACCESS_TOKEN=$/m);
const googleRoutingSetup = run("setup", "routing-eta", "--target", routingFixture).integrations[0];
assert.equal(googleRoutingSetup.status, "setup-required");
assert.deepEqual(googleRoutingSetup.missing, ["GOOGLE_ROUTES_API_KEY"]);
writeFileSync(
  join(routingFixture, ".env.local"),
  "ROUTING_PROVIDER=mapbox\nMAPBOX_ACCESS_TOKEN=test-mapbox-token\n",
);
const mapboxRoutingSetup = run("setup", "routing-eta", "--target", routingFixture).integrations[0];
assert.equal(mapboxRoutingSetup.status, "locally-configured");
assert.deepEqual(mapboxRoutingSetup.missing, []);
writeFileSync(
  join(routingFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ["node", "google.maps"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(
  resolve("node_modules", ".bin", "tsc"),
  ["--project", join(routingFixture, "tsconfig.json")],
  { stdio: "inherit" },
);

const routingClient = await import(pathToFileURL(resolve(
  "skills/compose-typescript-integrations/assets/recipes/routing-eta/template/client.ts",
)).href);
const originalFetch = globalThis.fetch;
const originalProvider = process.env.ROUTING_PROVIDER;
const originalGoogleKey = process.env.GOOGLE_ROUTES_API_KEY;
const originalMapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
try {
  process.env.ROUTING_PROVIDER = "google";
  process.env.GOOGLE_ROUTES_API_KEY = "test-google-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://routes.googleapis.com/directions/v2:computeRoutes");
    assert.equal(init.headers["X-Goog-Api-Key"], "test-google-key");
    const body = JSON.parse(init.body);
    assert.deepEqual(body.origin.location.latLng, { latitude: 5.561, longitude: -0.2077 });
    assert.equal(body.routingPreference, "TRAFFIC_AWARE");
    return Response.json({
      routes: [{
        distanceMeters: 8123,
        duration: "1020s",
        staticDuration: "780s",
        polyline: { encodedPolyline: "google-route" },
        warnings: ["test warning"],
      }],
    });
  };
  const googleEstimate = await routingClient.estimateRoute({
    origin: { latitude: 5.561, longitude: -0.2077 },
    destination: { latitude: 5.6224, longitude: -0.173 },
  });
  assert.deepEqual(googleEstimate, {
    provider: "google",
    mode: "driving",
    distanceMeters: 8123,
    durationSeconds: 1020,
    baselineDurationSeconds: 780,
    trafficAware: true,
    polyline: { encoded: "google-route", precision: 5 },
    warnings: ["test warning"],
  });
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
    const body = JSON.parse(init.body);
    assert.equal(body.origins.length, 1);
    assert.equal(body.destinations.length, 2);
    return Response.json([
      {
        originIndex: 0,
        destinationIndex: 0,
        condition: "ROUTE_EXISTS",
        distanceMeters: 8123,
        duration: "1020s",
        staticDuration: "780s",
      },
      { originIndex: 0, destinationIndex: 1, condition: "ROUTE_NOT_FOUND" },
    ]);
  };
  const googleMatrix = await routingClient.estimateRouteMatrix({
    origins: [{ latitude: 5.561, longitude: -0.2077 }],
    destinations: [
      { latitude: 5.6224, longitude: -0.173 },
      { latitude: 5.6037, longitude: -0.187 },
    ],
  });
  assert.equal(googleMatrix.elements[0].durationSeconds, 1020);
  assert.equal(googleMatrix.elements[1].condition, "route-not-found");

  process.env.ROUTING_PROVIDER = "mapbox";
  process.env.MAPBOX_ACCESS_TOKEN = "test-mapbox-token";
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    assert.match(parsed.pathname, /-0\.2077,5\.561;-0\.173,5\.6224$/);
    assert.equal(parsed.searchParams.get("access_token"), "test-mapbox-token");
    return Response.json({
      code: "Ok",
      routes: [{ distance: 7900, duration: 990, duration_typical: 760, geometry: "mapbox-route" }],
    });
  };
  const mapboxEstimate = await routingClient.estimateRoute({
    origin: { latitude: 5.561, longitude: -0.2077 },
    destination: { latitude: 5.6224, longitude: -0.173 },
  });
  assert.equal(mapboxEstimate.provider, "mapbox");
  assert.equal(mapboxEstimate.durationSeconds, 990);
  assert.equal(mapboxEstimate.baselineDurationSeconds, 760);
  assert.deepEqual(mapboxEstimate.polyline, { encoded: "mapbox-route", precision: 6 });
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.searchParams.get("sources"), "0");
    assert.equal(parsed.searchParams.get("destinations"), "1;2");
    return Response.json({
      code: "Ok",
      durations: [[990, null]],
      distances: [[7900, null]],
    });
  };
  const mapboxMatrix = await routingClient.estimateRouteMatrix({
    origins: [{ latitude: 5.561, longitude: -0.2077 }],
    destinations: [
      { latitude: 5.6224, longitude: -0.173 },
      { latitude: 5.6037, longitude: -0.187 },
    ],
  });
  assert.deepEqual(
    mapboxMatrix.elements.map((element) => element.condition),
    ["route-exists", "route-not-found"],
  );
  await assert.rejects(
    routingClient.estimateRoute({
      origin: { latitude: 95, longitude: 0 },
      destination: { latitude: 5.6224, longitude: -0.173 },
    }),
    /valid WGS84/,
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalProvider === undefined) delete process.env.ROUTING_PROVIDER;
  else process.env.ROUTING_PROVIDER = originalProvider;
  if (originalGoogleKey === undefined) delete process.env.GOOGLE_ROUTES_API_KEY;
  else process.env.GOOGLE_ROUTES_API_KEY = originalGoogleKey;
  if (originalMapboxToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
  else process.env.MAPBOX_ACCESS_TOKEN = originalMapboxToken;
}

const oidcFixture = tempFixture("integration-kit-oidc-");
mkdirSync(join(oidcFixture, "src", "app"), { recursive: true });
writeFileSync(
  join(oidcFixture, "package.json"),
  JSON.stringify({ private: true, type: "module", dependencies: { next: "^16.0.0" } }, null, 2),
);
const oidcResult = run("compose", "oidc", "--target", oidcFixture);
assert.equal(oidcResult.framework, "nextjs-16-app-router");
assert.ok(existsSync(join(oidcFixture, "src", "integrations", "oidc", "flow.ts")));
assert.ok(existsSync(join(oidcFixture, "src", "integrations", "oidc", "next-routes.ts")));
assert.match(
  readFileSync(join(oidcFixture, "src", "integrations", "server.ts"), "utf8"),
  /createOidcBeginRoute/,
);
for (const name of ["OIDC_ISSUER_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"]) {
  assert.match(readFileSync(join(oidcFixture, ".env.example"), "utf8"), new RegExp(`^${name}=$`, "m"));
}
writeFileSync(
  join(oidcFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["DOM", "DOM.Iterable", "ES2022"],
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ["node"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(
  resolve("node_modules", ".bin", "tsc"),
  ["--project", join(oidcFixture, "tsconfig.json")],
  { stdio: "inherit" },
);

const viteOidcFixture = tempFixture("integration-kit-vite-oidc-");
mkdirSync(join(viteOidcFixture, "src"), { recursive: true });
writeFileSync(
  join(viteOidcFixture, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: { vite: "^8.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
    },
    null,
    2,
  ),
);
run("compose", "oidc", "--target", viteOidcFixture);
assert.ok(existsSync(join(viteOidcFixture, "src", "integrations", "oidc", "browser.ts")));
assert.ok(!existsSync(join(viteOidcFixture, "src", "integrations", "oidc", "flow.ts")));
assert.equal(
  run("setup", "oidc", "--target", viteOidcFixture).integrations[0].status,
  "backend-setup-required",
);

const expressFixture = tempFixture("integration-kit-express-");
mkdirSync(join(expressFixture, "src"), { recursive: true });
writeFileSync(
  join(expressFixture, "package.json"),
  JSON.stringify(
    {
      private: true,
      dependencies: {
        express: "^4.0.0",
        "paystack-api": "^2.0.0",
        "@aws-sdk/client-s3": "^3.0.0",
      },
      devDependencies: { typescript: "^5.0.0", "@types/express": "^5.0.0" },
    },
    null,
    2,
  ),
);
const expressInspection = run("inspect", "--target", expressFixture);
assert.equal(expressInspection.framework, "express-typescript");
assert.deepEqual(
  expressInspection.existingIntegrationSignals.map((signal) => signal.integration),
  ["paystack", "r2"],
);
const expressResult = run("compose", "clerk", "paystack", "r2", "routing-eta", "--target", expressFixture);
assert.equal(expressResult.framework, "express-typescript");
assert.ok(existsSync(join(expressFixture, "src", "integrations", "clerk", "middleware.ts")));
assert.ok(existsSync(join(expressFixture, "src", "integrations", "paystack", "express-routes.ts")));
assert.ok(existsSync(join(expressFixture, "src", "integrations", "r2", "express-routes.ts")));
assert.ok(existsSync(join(expressFixture, "src", "integrations", "routing-eta", "express-routes.ts")));
assert.match(
  readFileSync(join(expressFixture, "src", "integrations", "server.ts"), "utf8"),
  /createPaymentInitializeHandler/,
);
const expressSetup = run("setup", "clerk", "paystack", "r2", "--target", expressFixture);
assert.ok(expressSetup.integrations.every((integration) => integration.status === "setup-required"));
for (const integration of expressSetup.integrations) {
  assert.ok(integration.guide.agentActions.length >= 4);
  assert.ok(integration.guide.humanActions.length >= 1);
  assert.ok(integration.guide.completionCriteria.length >= 3);
}
const r2Setup = expressSetup.integrations.find((integration) => integration.id === "r2");
assert.equal(r2Setup.existingSignals[0].integration, "r2");
assert.ok(r2Setup.guide.completionCriteria.some((item) => /put\/get\/delete/.test(item)));
const expressDoctor = run("doctor", "r2", "--target", expressFixture);
assert.deepEqual(expressDoctor.probes, [
  { id: "r2", status: "not-run", detail: "pass --live after configuration" },
]);
writeFileSync(
  join(expressFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        types: ["node"],
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(
  resolve("node_modules", ".bin", "tsc"),
  ["--project", join(expressFixture, "tsconfig.json")],
  { stdio: "inherit" },
);

const oidcExpressFixture = tempFixture("integration-kit-oidc-express-");
mkdirSync(join(oidcExpressFixture, "src"), { recursive: true });
writeFileSync(
  join(oidcExpressFixture, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: { express: "^5.0.0" },
      devDependencies: { typescript: "^5.0.0", "@types/express": "^5.0.0" },
    },
    null,
    2,
  ),
);
const oidcExpress = run("compose", "oidc", "--target", oidcExpressFixture);
assert.equal(oidcExpress.framework, "express-typescript");
assert.ok(existsSync(join(oidcExpressFixture, "src", "integrations", "oidc", "express-routes.ts")));
assert.match(
  readFileSync(join(oidcExpressFixture, "src", "integrations", "server.ts"), "utf8"),
  /createOidcCallbackHandler/,
);
writeFileSync(
  join(oidcExpressFixture, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        types: ["node"],
        allowImportingTsExtensions: true,
      },
      include: ["src"],
    },
    null,
    2,
  ),
);
execFileSync(
  resolve("node_modules", ".bin", "tsc"),
  ["--project", join(oidcExpressFixture, "tsconfig.json")],
  { stdio: "inherit" },
);

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
rmSync(socialFixture, { recursive: true, force: true });
rmSync(workspaceFixture, { recursive: true, force: true });
rmSync(viteFixture, { recursive: true, force: true });
rmSync(googleMapsFixture, { recursive: true, force: true });
rmSync(routingFixture, { recursive: true, force: true });
rmSync(oidcFixture, { recursive: true, force: true });
rmSync(viteOidcFixture, { recursive: true, force: true });
rmSync(expressFixture, { recursive: true, force: true });
rmSync(oidcExpressFixture, { recursive: true, force: true });
console.log("scaffolder and starter typecheck tests passed");
