import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const sqlRoot = path.resolve(process.cwd(), "sql");

const loadSql = (...segments: string[]) => readFileSync(path.join(sqlRoot, ...segments), "utf8");

const loadSqlDirectory = (...segments: string[]) =>
  readdirSync(path.join(sqlRoot, ...segments))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => loadSql(...segments, fileName));

export const queries = {
  migrations: loadSqlDirectory("migrations"),
  health: {
    check: loadSql("health", "check.sql")
  },
  jobs: {
    create: loadSql("jobs", "create.sql"),
    complete: loadSql("jobs", "complete.sql"),
    fail: loadSql("jobs", "fail.sql"),
    list: loadSql("jobs", "list.sql"),
    listAll: loadSql("jobs", "list_all.sql"),
    listForUser: loadSql("jobs", "list_for_user.sql"),
    get: loadSql("jobs", "get.sql")
  },
  users: {
    create: loadSql("users", "create.sql"),
    findByEmail: loadSql("users", "find_by_email.sql"),
    list: loadSql("users", "list.sql"),
    updateProfile: loadSql("users", "update_profile.sql"),
    upsertAdmin: loadSql("users", "upsert_admin.sql")
  },
  resumeVersions: {
    create: loadSql("resume_versions", "create.sql"),
    listForUser: loadSql("resume_versions", "list_for_user.sql")
  },
  sessions: {
    create: loadSql("sessions", "create.sql"),
    findByTokenHash: loadSql("sessions", "find_by_token_hash.sql"),
    delete: loadSql("sessions", "delete.sql"),
    deleteExpired: loadSql("sessions", "delete_expired.sql")
  },
  admin: {
    stats: loadSql("admin", "stats.sql")
  },
  resumeChunks: {
    upsert: loadSql("resume_chunks", "upsert.sql"),
    match: loadSql("resume_chunks", "match.sql")
  },
  transactions: {
    begin: loadSql("transactions", "begin.sql"),
    commit: loadSql("transactions", "commit.sql"),
    rollback: loadSql("transactions", "rollback.sql")
  }
};
