import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync(join(root, "package.json")), "Missing package.json");
assert(existsSync(join(root, ".env.example")), "Missing .env.example");
assert(existsSync(join(root, "next.config.mjs")), "Missing next.config.mjs");

const pkg = JSON.parse(read("package.json"));
const env = read(".env.example");
const nextConfig = read("next.config.mjs");
const netlify = existsSync(join(root, "netlify.toml")) ? read("netlify.toml") : "";

assert(pkg.scripts?.["platform:build"], "Missing platform:build script");
assert(pkg.scripts?.["validate:platform"], "Missing validate:platform script");
assert(!pkg.scripts?.["netlify:build"], "Remove platform-specific netlify:build script; auto-deploy is handled by the platform");
assert(!pkg.scripts?.["smoke:netlify"], "Remove smoke:netlify script; deployment smoke checks are external/manual");
assert(!JSON.stringify(pkg).includes('"latest"'), "Dependencies must not use latest");

if (netlify) {
  assert(netlify.includes('command = "npm run platform:build"'), "Netlify must use the generic platform:build command");
  assert(netlify.includes('publish = ".next"'), "Netlify publish directory must be .next for Next.js runtime");
  assert(netlify.includes('@netlify/plugin-nextjs'), "Netlify Next.js plugin missing");
  assert(netlify.includes('NODE_VERSION = "22"'), "Node 22 must be pinned for platform parity");
}

for (const token of ["Content-Security-Policy", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]) {
  assert(nextConfig.includes(token), `Missing security header: ${token}`);
}

for (const key of [
  "NEXT_PUBLIC_DEMO_MODE",
  "ROUTSIFY_ALLOW_PUBLIC_DEMO",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ROUTSIFY_INTERNAL_API_TOKEN",
  "CRON_SECRET",
  "PROPOSAL_TOKEN_SECRET",
  "FORM_WEBHOOK_SECRET",
  "BOOKING_WEBHOOK_SECRET",
  "HOLDED_API_KEY",
]) {
  assert(env.includes(`${key}=`), `Missing env placeholder: ${key}`);
}

console.log("Platform build validation passed.");
