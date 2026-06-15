import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { ResumeAnalysis } from "../../src/shared/types";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123";
const resumeFixture = path.resolve("tests/fixtures/resume.md");
const seedCompletedApplicationSql = readFileSync(
  path.resolve("tests/fixtures/seed_completed_application.sql"),
  "utf8"
);

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 100_000)}@example.com`;

const seededAnalysis: ResumeAnalysis = {
  candidateSummary: "Candidate matches the backend role through TypeScript service delivery and database ownership.",
  fitScore: 82,
  fitLevel: "high",
  strengths: ["Built secure TypeScript APIs", "Owned PostgreSQL-backed services"],
  gaps: ["Missing Kubernetes deployment depth"],
  risks: ["Limited enterprise Java evidence"],
  recommendations: ["Add PostgreSQL metrics", "Emphasize production API ownership"],
  suggestedKeywords: ["TypeScript", "PostgreSQL", "REST APIs"],
  interviewQuestions: ["Which API decisions improved reliability?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Build secure TypeScript services",
      importance: "must_have",
      status: "met",
      evidence: ["Built secure TypeScript APIs"],
      rationale: "The resume directly supports secure TypeScript service delivery."
    }
  ],
  scoreBreakdown: {
    minimumQualifications: 84,
    roleCompetencies: 88,
    domainExperience: 76,
    preferredQualifications: 70,
    seniorityScope: 82,
    evidenceQuality: 86
  },
  fairnessReview: {
    ignoredFactors: ["name", "address"],
    notes: ["The assessment ignored identity and location clues."]
  },
  evidence: [{ id: 1, text: "REST API delivery evidence with PostgreSQL ownership.", score: 0.84 }]
};

const seedCompletedApplication = async ({
  userId,
  jobTitle
}: {
  userId: number;
  jobTitle: string;
}) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      seedCompletedApplicationSql,
      [
        userId,
        jobTitle,
        "Build secure TypeScript services and PostgreSQL-backed APIs.",
        "seeded-resume.md",
        "Add PostgreSQL metrics\nEmphasize production API ownership",
        JSON.stringify(seededAnalysis)
      ]
    );
  } finally {
    await client.end();
  }
};

test.describe.serial("resume analyzer account and profile flows", () => {
  test("requires authentication before reading applications", async ({ request }) => {
    const response = await request.get("/api/jobs");

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Sign in to continue." });
  });

  test("registers a user, updates profile, and stores resume uploads as separate versions", async ({ page }) => {
    const email = uniqueEmail("e2e-user");
    const updatedEmail = uniqueEmail("e2e-updated");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Create account" })).not.toBeVisible();
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

    await page.getByPlaceholder("Jane Doe").fill("E2E Candidate");
    await page.getByPlaceholder("jane@example.com").fill(email);
    await page.getByPlaceholder("12+ chars, mixed case, number").fill("SecurePass123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("New analysis")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Profile" }).first().click();
    await expect(page.getByRole("heading", { name: "User Profile" })).toBeVisible();

    await page.locator(".profile-form").first().getByRole("textbox").first().fill("E2E Candidate Updated");
    await page.locator(".profile-form").first().getByRole("textbox").nth(1).fill(updatedEmail);
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Profile updated.")).toBeVisible();
    await expect(page.getByText(updatedEmail)).toBeVisible();

    const uploadInput = page.locator('input[type="file"]').last();
    await uploadInput.setInputFiles(resumeFixture);
    await page.getByRole("button", { name: "Upload new version" }).click();
    await expect(page.getByText("Version 1")).toBeVisible();

    await uploadInput.setInputFiles(resumeFixture);
    await page.getByRole("button", { name: "Upload new version" }).click();
    await expect(page.getByText("Version 2")).toBeVisible();
    await expect(page.getByText("Version 1")).toBeVisible();

    const versionRows = page.locator(".resume-version-row");
    await expect(versionRows).toHaveCount(2);
  });

  test("allows admin overview and denies the same endpoint to regular users", async ({ page, request }) => {
    const regularEmail = uniqueEmail("e2e-regular");

    const regularRegistration = await request.post("/api/register", {
      data: {
        name: "Regular E2E User",
        email: regularEmail,
        password: "SecurePass123"
      }
    });
    expect(regularRegistration.status()).toBe(201);
    const regularSession = await regularRegistration.json();

    const denied = await request.get("/api/admin/overview", {
      headers: {
        Authorization: `Bearer ${regularSession.token}`
      }
    });
    expect(denied.status()).toBe(403);
    const healthDenied = await request.get("/api/admin/system-health", {
      headers: {
        Authorization: `Bearer ${regularSession.token}`
      }
    });
    expect(healthDenied.status()).toBe(403);

    await page.goto("/");
    await page.getByPlaceholder("admin@example.com").fill(adminEmail);
    await page.getByPlaceholder("Account password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(regularEmail)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job Postings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Candidate Matches" })).toBeVisible();

    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.getByRole("heading", { name: "System Health" })).toBeVisible();
    await expect(page.getByText("PostgreSQL")).toBeVisible();
    await expect(page.getByText("pgvector")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Application Instances" })).toBeVisible();
    await expect(page.getByText("app-1", { exact: true })).toBeVisible();
    await expect(page.getByText("app-2", { exact: true })).toBeVisible();

    const postingTitle = `E2E Platform Engineer ${Date.now()}`;
    await page.getByRole("button", { name: "Add jobs" }).click();
    await expect(page.getByRole("heading", { name: "Add job posting" })).toBeVisible();
    await page.getByPlaceholder("Backend Platform Engineer").fill(postingTitle);
    await page.getByPlaceholder("Type a skill and press Enter").fill("TypeScript");
    await page.getByRole("button", { name: "Add skill" }).click();
    await page.getByPlaceholder("Type a skill and press Enter").fill("PostgreSQL");
    await page.keyboard.press("Enter");
    await page
      .getByPlaceholder("Paste the job posting requirements, responsibilities, and qualifications.")
      .fill("Build secure TypeScript services, PostgreSQL systems, and production APIs.");
    await page.getByRole("button", { name: "Publish job posting" }).click();

    await expect(page.getByText("Job posting saved and selected for analysis.")).toBeVisible();
    const postingCard = page.locator(".posting-card").filter({ hasText: postingTitle });
    await expect(postingCard).toBeVisible();
    await expect(postingCard.locator(".tag-chip").filter({ hasText: "TypeScript" })).toBeVisible();
  });

  test("expands profile applications with stored analysis details", async ({ page, request }) => {
    test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required to seed stored applications.");

    const email = uniqueEmail("e2e-application-details");
    const password = "SecurePass123";
    const jobTitle = `Seeded Backend Role ${Date.now()}`;

    const registration = await request.post("/api/register", {
      data: {
        name: "Application Details User",
        email,
        password
      }
    });
    expect(registration.status()).toBe(201);
    const session = await registration.json();
    await seedCompletedApplication({ userId: session.user.id, jobTitle });

    await page.goto("/");
    await page.getByPlaceholder("admin@example.com").fill(email);
    await page.getByPlaceholder("Account password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("button", { name: "Profile" }).first().click();
    await expect(page.getByRole("heading", { name: "My Application Details" })).toBeVisible();

    const application = page.locator(".application-card").filter({ hasText: jobTitle });
    await expect(application).toBeVisible();
    await expect(application.getByText("Candidate summary")).toBeVisible();
    await expect(application.getByText("HR Score Breakdown")).toBeVisible();
    await expect(application.getByText("Requirement Assessment")).toBeVisible();
    await expect(application.getByText("Build secure TypeScript services", { exact: true })).toBeVisible();
    await expect(application.getByText("Fairness Review")).toBeVisible();
    await expect(application.getByText("The assessment ignored identity and location clues.")).toBeVisible();
    await expect(application.getByText("Built secure TypeScript APIs").first()).toBeVisible();
    await expect(application.getByText("Missing Kubernetes deployment depth")).toBeVisible();
    await expect(application.getByText("Add PostgreSQL metrics", { exact: true })).toBeVisible();
    await expect(application.getByText("Ranked evidence")).toBeVisible();
    await expect(application.getByText("REST API delivery evidence with PostgreSQL ownership.")).toBeVisible();
  });
});
