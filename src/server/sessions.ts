import { createHash, randomBytes } from "node:crypto";
import type { UserRecord } from "../shared/types.js";
import { config } from "./config.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type SessionUserRow = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
};

export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

const mapUser = (row: SessionUserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at
});

export const createSession = async (userId: number) => {
  const token = randomBytes(32).toString("base64url");
  await queryPostgres(queries.sessions.deleteExpired);
  await queryPostgres(queries.sessions.create, [userId, hashSessionToken(token), config.sessionTtlSeconds]);

  return token;
};

export const findUserBySessionToken = async (token: string): Promise<UserRecord | undefined> => {
  const result = await queryPostgres<SessionUserRow>(queries.sessions.findByTokenHash, [hashSessionToken(token)]);
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
};

export const deleteSession = async (token: string) => {
  await queryPostgres(queries.sessions.delete, [hashSessionToken(token)]);
};
