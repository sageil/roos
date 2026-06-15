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
    convertToApplication: loadSql("jobs", "convert_to_application.sql"),
    complete: loadSql("jobs", "complete.sql"),
    existsForUserPosting: loadSql("jobs", "exists_for_user_posting.sql"),
    fail: loadSql("jobs", "fail.sql"),
    list: loadSql("jobs", "list.sql"),
    listAll: loadSql("jobs", "list_all.sql"),
    listForPosting: loadSql("jobs", "list_for_posting.sql"),
    listForUser: loadSql("jobs", "list_for_user.sql"),
    get: loadSql("jobs", "get.sql"),
    search: loadSql("jobs", "search.sql"),
    updateInterviewQuestions: loadSql("jobs", "update_interview_questions.sql")
  },
  jobPostings: {
    create: loadSql("job_postings", "create.sql"),
    getActive: loadSql("job_postings", "get_active.sql"),
    list: loadSql("job_postings", "list.sql")
  },
  jobPostingMatchProfiles: {
    source: loadSql("job_posting_match_profiles", "source.sql"),
    upsert: loadSql("job_posting_match_profiles", "upsert.sql"),
    match: loadSql("job_posting_match_profiles", "match.sql")
  },
  users: {
    create: loadSql("users", "create.sql"),
    findById: loadSql("users", "find_by_id.sql"),
    findByEmail: loadSql("users", "find_by_email.sql"),
    list: loadSql("users", "list.sql"),
    listAdminDetails: loadSql("users", "list_admin_details.sql"),
    updateProfile: loadSql("users", "update_profile.sql"),
    upsertAdmin: loadSql("users", "upsert_admin.sql")
  },
  resumeVersions: {
    create: loadSql("resume_versions", "create.sql"),
    download: loadSql("resume_versions", "download.sql"),
    latestForUser: loadSql("resume_versions", "latest_for_user.sql"),
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
  appSettings: {
    get: loadSql("app_settings", "get.sql"),
    upsert: loadSql("app_settings", "upsert.sql")
  },
  analysisCache: {
    get: loadSql("analysis_cache", "get.sql"),
    upsert: loadSql("analysis_cache", "upsert.sql")
  },
  resumeChunks: {
    upsert: loadSql("resume_chunks", "upsert.sql"),
    upsertMany: loadSql("resume_chunks", "upsert_many.sql"),
    match: loadSql("resume_chunks", "match.sql"),
    matchJobs: loadSql("resume_chunks", "match_jobs.sql")
  },
  userMatchProfiles: {
    source: loadSql("user_match_profiles", "source.sql"),
    upsert: loadSql("user_match_profiles", "upsert.sql"),
    match: loadSql("user_match_profiles", "match.sql")
  },
  transactions: {
    advisoryLock: loadSql("transactions", "advisory_lock.sql"),
    advisoryUnlock: loadSql("transactions", "advisory_unlock.sql"),
    begin: loadSql("transactions", "begin.sql"),
    commit: loadSql("transactions", "commit.sql"),
    rollback: loadSql("transactions", "rollback.sql")
  }
};
