import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../src/server/config.js";
import { closePostgres, connectPostgres } from "../src/server/database.js";
import { hashPassword } from "../src/server/passwords.js";

type SeedSummaryRow = {
  users_seeded: number;
  job_postings_seeded: number;
  resume_versions_seeded: number;
  applications_seeded: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlPath = path.resolve(__dirname, "../sql/admin/seed_demo_data.sql");

const demoPassword = process.env.DEMO_USER_PASSWORD || "DemoUserPassword123";
const adminEmail = (process.env.ADMIN_EMAIL || config.adminEmail).toLowerCase();

const main = async () => {
  const seedSql = readFileSync(sqlPath, "utf8");
  const passwordHash = await hashPassword(demoPassword);
  const client = await connectPostgres();

  try {
    const result = await client.query<SeedSummaryRow>(seedSql, [
      passwordHash,
      adminEmail,
      config.llmModel,
      config.embeddingModel
    ]);
    const summary = result.rows[0];

    if (!summary) {
      throw new Error("Seed completed without a summary row.");
    }

    console.log(
      [
        `Seeded ${summary.users_seeded} demo users`,
        `${summary.job_postings_seeded} job postings`,
        `${summary.resume_versions_seeded} resume versions`,
        `${summary.applications_seeded} completed applications`,
        `demo password: ${demoPassword}`
      ].join("\n")
    );
  } finally {
    client.release();
    await closePostgres();
  }
};

main().catch(async (error) => {
  await closePostgres().catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
