// Aplica los scripts de db/*.sql en orden contra DATABASE_URL (son idempotentes).
//
//   pnpm db:migrate          aplica db/001_*.sql, db/002_*.sql, ...
//   pnpm db:migrate --check  solo lista las tablas existentes, sin modificar nada
//
// La cadena de conexión se lee de DATABASE_URL (entorno o .env); nunca se imprime.

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usa el entorno */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (entorno o archivo .env).");
  process.exit(1);
}

const checkOnly = process.argv.includes("--check");
const dir = path.resolve(import.meta.dirname, "..", "db");
const files = fs
  .readdirSync(dir)
  .filter(f => /^\d+_.+\.sql$/.test(f))
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`
  );
  console.log(
    rows.length
      ? `Tablas existentes en public: ${rows.map(r => r.table_name).join(", ")}`
      : "La base está vacía (sin tablas en public)."
  );

  if (!checkOnly) {
    for (const file of files) {
      console.log(`Aplicando ${file} ...`);
      await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    }
    const after = await client.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`
    );
    console.log(`Listo. Tablas: ${after.rows.map(r => r.table_name).join(", ")}`);
  }
} finally {
  await client.end();
}
