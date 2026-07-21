import fs from "node:fs";

const directory = "supabase/migrations";
const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
const versions = new Map();
const failures = [];

for (const file of files) {
  const match = file.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
  if (!match) {
    failures.push(`${file}: expected <14-digit timestamp>_<snake_case_name>.sql`);
    continue;
  }
  const [, version] = match;
  if (versions.has(version)) failures.push(`${file}: duplicates version used by ${versions.get(version)}`);
  versions.set(version, file);
  if (!fs.readFileSync(`${directory}/${file}`, "utf8").trim()) failures.push(`${file}: migration is empty`);
}

if (failures.length) {
  console.error("Migration validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Migration validation passed for ${files.length} ordered migrations.`);
