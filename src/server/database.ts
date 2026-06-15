import pg from "pg";
import type { QueryResultRow } from "pg";
import { config } from "./config.js";
import { queries } from "./sql.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl
});

let initialized: Promise<void> | undefined;
const migrationLockId = 23078787;

export const initPostgres = async () => {
  initialized ??= (async () => {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(queries.transactions.advisoryLock, [migrationLockId]);
      locked = true;
      for (const migration of queries.migrations) {
        await client.query(migration);
      }
    } finally {
      try {
        if (locked) {
          await client.query(queries.transactions.advisoryUnlock, [migrationLockId]);
        }
      } finally {
        client.release();
      }
    }
  })().catch((error) => {
    initialized = undefined;
    throw error;
  });

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

export const closePostgres = async () => {
  await pool.end();
};
