import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(existsSync(join(root, "netlify.toml")), "Missing netlify.toml");
assert(existsSync(join(root, "package.json")), "Missing package.json");
assert(existsSync(join(root, ".env.example")), "Missing .env.example");

const netlify = read("netlify.toml");
const pkg = JSON.parse(read("package.json"));
const env = read(".env.example");

assert(netlify.includes('command = "npm run netlify:build"'), "Netlify build command must run netlify:build");
assert(netlify.includes('publish = ".next"'), "Netlify publish directory must be .next for Next.js runtime");
assert(netlify.includes('@netlify/plugin-nextjs'), "Netlify Next.js plugin missing");
assert(netlify.includes('NODE_VERSION = "20"'), "Node 20 must be pinned for deploy parity");

assert(pkg.scripts?.["netlify:build"], "Missing netlify:build script");
assert(pkg.scripts?.["validate:deploy"], "Missing validate:deploy script");
assert(pkg.devDependencies?.["@netlify/plugin-nextjs"], "Missing @netlify/plugin-nextjs devDependency");

for (const key of [
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PROPOSAL_TOKEN_SECRET",
  "FORM_WEBHOOK_SECRET",
  "BOOKING_WEBHOOK_SECRET",
  "HOLDED_API_KEY",
]) {
  assert(env.includes(`${key}=`), `Missing env placeholder: ${key}`);
}

console.log("Netlify deployment validation passed.");
