import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "DATABASE_URL is required for PostgreSQL persistence.",
    );
  }

  return value;
}

export function getPostgresPool(): Pool {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ECC_DB_SSL === "false"
  ) {
    throw new Error(
      "PostgreSQL TLS cannot be disabled in production.",
    );
  }

  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: Number(
      process.env.ECC_DB_POOL_MAX ?? "5",
    ),
    idleTimeoutMillis: Number(
      process.env.ECC_DB_IDLE_TIMEOUT_MS ?? "10000",
    ),
    connectionTimeoutMillis: Number(
      process.env.ECC_DB_CONNECTION_TIMEOUT_MS ?? "5000",
    ),
    ssl:
      process.env.ECC_DB_SSL === "false"
        ? false
        : {
            rejectUnauthorized: true,
            ...(process.env.ECC_DB_CA_CERT
              ? {
                  ca: process.env.ECC_DB_CA_CERT.replace(
                    /\\n/g,
                    String.fromCharCode(10),
                  ),
                }
              : {}),
          },
  });

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPostgresPool().query<T>(
    text,
    values,
  );
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client =
    await getPostgresPool().connect();

  try {
    await client.query("BEGIN");

    const result = await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkPostgresConnection(): Promise<{
  ok: true;
  now: string;
}> {
  const result = await query<{
    now: string;
  }>("SELECT NOW()::text AS now");

  return {
    ok: true,
    now: result.rows[0]?.now ?? "",
  };
}

export function isPostgresConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim(),
  );
}
