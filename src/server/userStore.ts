import type {
  AdminStats,
  AdminUserDetailRecord,
  AdminUserRecord,
  JobRecord,
  ResumeVersionRecord,
  UserRecord
} from "../shared/types.js";
import { queryPostgres } from "./database.js";
import { queries } from "./sql.js";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  password_hash?: string;
  created_at: string;
};

type AdminUserRow = UserRow & {
  application_count: number;
};

type AdminUserDetailRow = AdminUserRow & {
  resume_json: ResumeVersionRecord | string | null;
  recent_jobs_json: JobRecord[] | string | null;
  matched_terms: string[] | null;
};

type AdminStatsRow = {
  user_count: number;
  job_count: number;
  job_posting_count: number;
  completed_job_count: number;
  failed_job_count: number;
};

const mapUserRow = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at
});

const mapAdminUserRow = (row: AdminUserRow): AdminUserRecord => ({
  ...mapUserRow(row),
  applicationCount: row.application_count
});

const parseJsonValue = <T>(value: T | string | null): T | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const mapAdminUserDetailRow = (row: AdminUserDetailRow): AdminUserDetailRecord => ({
  ...mapAdminUserRow(row),
  latestResume: parseJsonValue<ResumeVersionRecord>(row.resume_json),
  recentApplications: parseJsonValue<JobRecord[]>(row.recent_jobs_json) ?? [],
  matchedTerms: row.matched_terms ?? []
});

export const createUser = async ({
  name,
  email,
  passwordHash
}: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRecord> => {
  try {
    const result = await queryPostgres<UserRow>(queries.users.create, [
      name,
      email.toLowerCase(),
      passwordHash
    ]);

    return mapUserRow(result.rows[0]);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }

    throw error;
  }
};

export const findUserByEmail = async (email: string) => {
  const result = await queryPostgres<UserRow>(queries.users.findByEmail, [email.toLowerCase()]);
  const row = result.rows[0];

  return row
    ? {
        user: mapUserRow(row),
        passwordHash: row.password_hash ?? ""
      }
    : undefined;
};

export const updateUserProfile = async ({
  id,
  name,
  email
}: {
  id: number;
  name: string;
  email: string;
}): Promise<UserRecord> => {
  try {
    const result = await queryPostgres<UserRow>(queries.users.updateProfile, [
      id,
      name,
      email.toLowerCase()
    ]);

    return mapUserRow(result.rows[0]);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }

    throw error;
  }
};

export const listUsers = async (limit = 100): Promise<AdminUserRecord[]> => {
  const result = await queryPostgres<AdminUserRow>(queries.users.list, [limit]);
  return result.rows.map(mapAdminUserRow);
};

export const listAdminUserDetails = async ({
  search = "",
  limit = 100
}: {
  search?: string;
  limit?: number;
} = {}): Promise<AdminUserDetailRecord[]> => {
  const result = await queryPostgres<AdminUserDetailRow>(queries.users.listAdminDetails, [
    search.trim(),
    limit
  ]);

  return result.rows.map(mapAdminUserDetailRow);
};

export const upsertAdminUser = async ({
  name,
  email,
  passwordHash
}: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRecord> => {
  const result = await queryPostgres<UserRow>(queries.users.upsertAdmin, [
    name,
    email.toLowerCase(),
    passwordHash
  ]);

  return mapUserRow(result.rows[0]);
};

export const getAdminStats = async (): Promise<AdminStats> => {
  const result = await queryPostgres<AdminStatsRow>(queries.admin.stats);
  const row = result.rows[0];

  return {
    userCount: row.user_count,
    jobCount: row.job_count,
    jobPostingCount: row.job_posting_count,
    completedJobCount: row.completed_job_count,
    failedJobCount: row.failed_job_count
  };
};
