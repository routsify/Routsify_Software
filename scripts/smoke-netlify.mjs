const baseUrl = process.env.NETLIFY_SMOKE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "https://sunny-strudel-c3836a.netlify.app";

const paths = [
  "/api/health",
  "/hoy",
  "/clientes",
  "/expedientes",
  "/expedientes/EXP-2026-0001",
  "/propuestas",
  "/propuestas/demo-public-token",
  "/compras",
  "/viajeros",
  "/contratos",
  "/informes",
  "/ajustes",
];

async function check(path) {
  const response = await fetch(new URL(path, baseUrl), { redirect: "follow" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return { path, status: response.status };
}

for (const path of paths) {
  const result = await check(path);
  console.log(`${result.status} ${result.path}`);
}

console.log(`Netlify smoke test passed for ${baseUrl}`);
