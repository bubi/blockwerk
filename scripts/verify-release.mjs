import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Validate a fresh source snapshot without resetting the developer's D1.
// Deliberately never deploys, imports data, or applies remote migrations.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--e2e")) {
  console.error("Usage: node scripts/verify-release.mjs [--e2e]");
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = await mkdtemp(path.join(tmpdir(), "blockwerk-release-"));
const sources = [
  "src", "worker", "shared", "migrations", "e2e", "public", "design", "scripts",
  "package.json", "package-lock.json", "tsconfig.json", "tsconfig.app.json",
  "tsconfig.worker.json", "tsconfig.node.json", "worker-configuration.d.ts",
  "vite.config.ts", "eslint.config.js", "playwright.config.ts", "wrangler.jsonc",
  "index.html", "seed.sql",
];
for (const source of sources) {
  await cp(path.join(root, source), path.join(workspace, source), { recursive: true });
}
try {
  await cp(path.join(root, ".dev.vars"), path.join(workspace, ".dev.vars"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log(`Isolated release workspace: ${workspace}`);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [
  ["ci", "--no-audit", "--no-fund"],
  ["run", "build"],
  ["run", "lint"],
  ["test"],
  ["run", "test:workers"],
];
if (args.includes("--e2e")) steps.push(["run", "test:e2e"]);
steps.push(["exec", "--no", "--", "wrangler", "deploy", "--dry-run"]);
for (const step of steps) {
  const result = spawnSync(npm, step, { cwd: workspace, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Checks passed. Fresh build and deployment tools are in ${workspace}.`);
console.log("This snapshot has not been published. Re-run after changing source files.");
