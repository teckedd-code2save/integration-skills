#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const recipesRoot = join(skillRoot, "assets", "recipes");

function fail(message, code = 1) {
  console.error(`integration-kit: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {
    command: argv[0],
    recipes: [],
    target: process.cwd(),
    force: false,
    install: false,
    dryRun: false,
    json: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--target") options.target = argv[++index];
    else if (value === "--force") options.force = true;
    else if (value === "--install") options.install = true;
    else if (value === "--dry-run") options.dryRun = true;
    else if (value === "--json") options.json = true;
    else if (value.startsWith("--")) fail(`unknown option ${value}`);
    else options.recipes.push(value);
  }

  options.target = resolve(options.target);
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`could not read ${path}: ${error.message}`);
  }
}

function availableRecipes() {
  return ["clerk", "paystack", "r2", "mapbox"].map((id) =>
    readJson(join(recipesRoot, id, "recipe.json")),
  );
}

function packageManager(target) {
  if (existsSync(join(target, "pnpm-lock.yaml"))) return ["pnpm", "add"];
  if (existsSync(join(target, "yarn.lock"))) return ["yarn", "add"];
  if (existsSync(join(target, "bun.lockb")) || existsSync(join(target, "bun.lock"))) {
    return ["bun", "add"];
  }
  return ["npm", "install"];
}

function inspectNextProject(target) {
  const packagePath = join(target, "package.json");
  if (!existsSync(packagePath)) fail(`no package.json found in ${target}`);

  const packageJson = readJson(packagePath);
  const nextRange = packageJson.dependencies?.next ?? packageJson.devDependencies?.next;
  if (!nextRange) fail("the first release supports Next.js App Router projects only");

  const versionMatch = String(nextRange).match(/(\d+)/);
  const nextMajor = versionMatch ? Number(versionMatch[1]) : 16;
  const hasSrcApp = existsSync(join(target, "src", "app"));
  const hasRootApp = existsSync(join(target, "app"));
  if (!hasSrcApp && !hasRootApp) {
    fail("no Next.js App Router directory found (expected src/app or app)");
  }

  return {
    src: hasSrcApp ? "src" : "",
    proxy: nextMajor >= 16 ? "proxy.ts" : "middleware.ts",
    nextMajor,
  };
}

function destinationPath(template, context) {
  return template
    .replaceAll("{{src}}", context.src)
    .replaceAll("{{proxy}}", context.proxy)
    .replace(/^\//, "")
    .replace(/\/+/g, "/");
}

function sameFile(left, right) {
  return existsSync(right) && readFileSync(left).equals(readFileSync(right));
}

function ensureEnvExample(target, variables, dryRun) {
  if (variables.length === 0) return { path: null, added: [] };
  const entries = variables.map((entry) =>
    typeof entry === "string" ? { name: entry, value: "" } : entry,
  );
  const envPath = join(target, ".env.example");
  const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const present = new Set(
    current
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter(Boolean),
  );
  const added = entries.filter((entry) => !present.has(entry.name));
  if (added.length > 0 && !dryRun) {
    const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    const block = added.map((entry) => `${entry.name}=${entry.value ?? ""}`).join("\n");
    writeFileSync(envPath, `${current}${separator}${block}\n`);
  }
  return { path: relative(target, envPath), added: added.map((entry) => entry.name) };
}

function installDependencies(target, dependencies) {
  if (dependencies.length === 0) return null;
  const [command, action] = packageManager(target);
  const result = spawnSync(command, [action, ...dependencies], {
    cwd: target,
    stdio: "inherit",
  });
  if (result.error) fail(`could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with status ${result.status}`);
  return `${command} ${action} ${dependencies.join(" ")}`;
}

function clerkReactCompatibility(target, dependencies) {
  if (!dependencies.includes("@clerk/nextjs")) return [];
  const packageJson = readJson(join(target, "package.json"));
  const minimumPatch = new Map([[0, 3], [1, 4], [2, 3]]);
  const adjustments = [];

  for (const name of ["react", "react-dom"]) {
    const range = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
    const match = String(range ?? "").match(/19\.(\d+)\.(\d+)/);
    if (!match) continue;
    const minor = Number(match[1]);
    const patch = Number(match[2]);
    const requiredPatch = minimumPatch.get(minor);
    if (requiredPatch !== undefined && patch < requiredPatch) {
      adjustments.push(`${name}@~19.${minor}.${requiredPatch}`);
    }
  }

  return adjustments;
}

function scaffoldRecipe(recipe, target, context, options) {
  const created = [];
  const unchanged = [];
  const skipped = [];

  for (const entry of recipe.files) {
    const source = join(recipesRoot, recipe.id, "template", entry.source);
    const destinationRelative = destinationPath(entry.destination, context);
    const destination = join(target, destinationRelative);
    if (!existsSync(source)) fail(`recipe ${recipe.id} is missing ${entry.source}`);

    if (sameFile(source, destination)) {
      unchanged.push(destinationRelative);
      continue;
    }
    if (existsSync(destination) && !options.force) {
      skipped.push(destinationRelative);
      continue;
    }
    if (!options.dryRun) {
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
    }
    created.push(destinationRelative);
  }

  const env = ensureEnvExample(target, recipe.env, options.dryRun);
  return {
    id: recipe.id,
    name: recipe.name,
    dependencies: recipe.dependencies,
    created,
    unchanged,
    skipped,
    env,
    manualSteps: recipe.manualSteps,
  };
}

function printList(recipes, json) {
  if (json) return console.log(JSON.stringify(recipes, null, 2));
  console.log("Available integration starters:\n");
  for (const recipe of recipes) console.log(`  ${recipe.id.padEnd(10)} ${recipe.name}`);
}

function printResult(result) {
  console.log(`\n${result.name}`);
  for (const path of result.created) console.log(`  created    ${path}`);
  for (const path of result.unchanged) console.log(`  unchanged  ${path}`);
  for (const path of result.skipped) console.log(`  skipped    ${path} (use --force to replace)`);
  for (const name of result.env.added) console.log(`  env        ${name}`);
  if (result.dependencies.length > 0) {
    console.log(`  packages   ${result.dependencies.join(" ")}`);
  }
  for (const step of result.manualSteps) console.log(`  next       ${step}`);
}

const options = parseArgs(process.argv.slice(2));
const recipes = availableRecipes();

if (options.command === "list") {
  printList(recipes, options.json);
  process.exit(0);
}

if (options.command !== "add" || options.recipes.length === 0) {
  fail(
    "usage: scaffold.mjs list | add <clerk|paystack|r2|mapbox>... [--target DIR] [--install] [--dry-run] [--force] [--json]",
  );
}

const selected = options.recipes.map((id) => {
  const recipe = recipes.find((item) => item.id === id);
  if (!recipe) fail(`unknown recipe ${id}; run 'scaffold.mjs list'`);
  return recipe;
});
const context = inspectNextProject(options.target);
const results = selected.map((recipe) =>
  scaffoldRecipe(recipe, options.target, context, options),
);
const recipeDependencies = results.flatMap((result) => result.dependencies);
const dependencies = [
  ...new Set([
    ...recipeDependencies,
    ...clerkReactCompatibility(options.target, recipeDependencies),
  ]),
];
const installed = options.install && !options.dryRun
  ? installDependencies(options.target, dependencies)
  : null;

const output = {
  target: options.target,
  framework: `nextjs-${context.nextMajor}-app-router`,
  dryRun: options.dryRun,
  dependencies,
  installed,
  results,
};

if (options.json) console.log(JSON.stringify(output, null, 2));
else {
  for (const result of results) printResult(result);
  if (!options.install && dependencies.length > 0) {
    const [command, action] = packageManager(options.target);
    console.log(`\nInstall dependencies:\n  ${command} ${action} ${dependencies.join(" ")}`);
  }
  if (results.some((result) => result.skipped.length > 0)) {
    console.log("\nExisting files were preserved. Ask the agent to merge them deliberately.");
  }
}
