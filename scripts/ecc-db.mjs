import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const mode = process.argv[2] ?? "check";

const databaseUrl =
  process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error(
    "DATABASE_URL is not configured.",
  );
  process.exit(2);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.ECC_DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

try {
  if (mode === "check") {
    const result = await pool.query(
      "SELECT NOW()::text AS now",
    );

    console.log(
      JSON.stringify({
        ok: true,
        mode: "check",
        now: result.rows[0]?.now ?? null,
      }),
    );
  } else if (mode === "init") {
    const schema = await fs.readFile(
      path.resolve(
        "src/lib/persistence/schema.sql",
      ),
      "utf8",
    );

    await pool.query(schema);

    console.log(
      JSON.stringify({
        ok: true,
        mode: "init",
      }),
    );
  } else {
    throw new Error(
      `Unknown mode: ${mode}`,
    );
  }
} finally {
  await pool.end();
}
