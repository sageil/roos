import pg from "pg";
import type { QueryResultRow } from "pg";
import { config } from "./config.js";
import { queries } from "./sql.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl
});

let initialized: Promise<void> | undefined;

export const initPostgres = async () => {
  initialized ??= (async () => {
    for (const migration of queries.migrations) {
      await pool.query(migration);
    }
  })();

  return initialized;
};

export const withPostgres = async <T>(operation: () => Promise<T>): Promise<T> => {
  await initPostgres();
  return operation();
};

export const queryPostgres = async <T extends QueryResultRow = QueryResultRow>(
  query: string,
  values?: unknown[]
) => withPostgres(() => pool.query<T>(query, values));

export const connectPostgres = async () => {
  await initPostgres();
  return pool.connect();
};

export const checkPostgres = async () => {
  await initPostgres();
  await pool.query(queries.health.check);
};
