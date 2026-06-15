import { expect, test, type Page } from "@playwright/test";
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
const seedResumeVersionSql = readFileSync(
  path.resolve("tests/fixtures/seed_resume_version.sql"),
  "utf8"
);

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 100_000)}@example.com`;

const signIn = async (page: Page, email: string, password: string) => {
  await page.getByPlaceholder("admin@example.com").fill(email);
  await page.getByPlaceholder("Account password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

const seededAnalysis: ResumeAnalysis = {
  candidateSummary: "Candidate matches the veterinary reception role through client intake, appointment scheduling, and clinic coordination evidence.",
  fitScore: 82,
  fitLevel: "high",
  strengths: ["Managed client intake", "Coordinated appointment books"],
  gaps: ["Confirm emergency triage confidence"],
  risks: ["Billing accuracy should be verified"],
  recommendations: ["Lead with reception workflow ownership", "Emphasize calm client communication"],
  suggestedKeywords: ["client intake", "appointment scheduling", "EFTPOS"],
  interviewQuestions: ["How do you handle a distressed pet owner at reception?"],
  requirementAssessments: [
    {
      category: "role_competency",
      requirement: "Manage client intake and appointment scheduling",
      importance: "must_have",
      status: "met",
      evidence: ["Managed client intake and appointment scheduling"],
      rationale: "The resume directly supports veterinary reception workflow ownership."
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
  evidence: [{ id: 1, text: "Veterinary reception evidence with client intake and scheduling ownership.", score: 0.84 }]
};

const seedCompletedApplication = async ({
  userId,
  jobTitle,
  jobDescription = "Manage client intake, appointment scheduling, EFTPOS payments, and phone triage.",
  resumeFileName = "seeded-resume.md",
  recommendation = "Lead with reception workflow ownership\nEmphasize calm client communication",
  analysis = seededAnalysis,
  analysisKind = "application",
  jobPostingId
}: {
  userId: number;
  jobTitle: string;
  jobDescription?: string;
  resumeFileName?: string;
  recommendation?: string;
  analysis?: ResumeAnalysis;
  analysisKind?: "application" | "candidate_assessment";
  jobPostingId?: number;
}): Promise<number> => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (analysisKind === "application" && !jobPostingId) {
      const result = await client.query(seedCompletedApplicationSql, [
        userId,
        jobTitle,
        jobDescription,
        resumeFileName,
        recommendation,
        JSON.stringify(analysis)
      ]);
      return Number(result.rows[0]?.id ?? 0);
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO jobs (
        user_id,
        job_posting_id,
        analysis_kind,
        status,
        application_date,
        job_title,
        job_description,
        resume_file_name,
        character_count,
        chunk_count,
        llm_recommendation,
        fit_score,
        fit_level,
        analysis_json,
        llm_model,
        embedding_model
      ) VALUES ($1, $2, $3, 'completed', '2026-06-14', $4, $5, $6, 2400, 1, $7, 82, 'high', $8::jsonb, 'e2e-llm', 'e2e-embedding')
      RETURNING id`,
      [
        userId,
        jobPostingId ?? null,
        analysisKind,
        jobTitle,
        jobDescription,
        resumeFileName,
        recommendation,
        JSON.stringify(analysis)
      ]
    );
    return Number(result.rows[0]?.id ?? 0);
  } finally {
    await client.end();
  }
};

const seedResumeVersion = async ({ userId, fileName }: { userId: number; fileName: string }) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(seedResumeVersionSql, [userId, fileName]);
  } finally {
    await client.end();
  }
};

test.describe.serial("Roos account and profile flows", () => {
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
    await page.getByPlaceholder("Retype account password").fill("SecurePass123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible();

    await page.getByRole("button", { name: "Profile" }).first().click();
    await expect(page.getByRole("heading", { name: "User Profile" })).toBeVisible();

    await page.locator(".profile-form").first().getByRole("textbox").first().fill("E2E Candidate Updated");
    await page.locator(".profile-form").first().getByRole("textbox").nth(1).fill(updatedEmail);
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Profile updated.")).toBeVisible();
    await expect(page.locator(".profile-form").first().getByRole("textbox").nth(1)).toHaveValue(updatedEmail);

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
    const userDownload = page.waitForEvent("download");
    await versionRows.first().getByRole("button", { name: "Download" }).click();
    expect((await userDownload).suggestedFilename()).toBe("resume-v2.md");
  });

  test("guides users without a resume to upload before applying", async ({ page }) => {
    const email = uniqueEmail("e2e-no-resume");

    await page.goto("/");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Jane Doe").fill("No Resume Candidate");
    await page.getByPlaceholder("jane@example.com").fill(email);
    await page.getByPlaceholder("12+ chars, mixed case, number").fill("SecurePass123");
    await page.getByPlaceholder("Retype account password").fill("SecurePass123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/applications$/);
    await page.getByRole("button", { name: "Jobs", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find roles" })).toBeVisible();
    await expect(page.locator(".posting-card").first()).toBeVisible();

    await page.getByRole("button", { name: "Upload resume to apply" }).first().click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Resume Versions" })).toBeVisible();
    await expect(page.getByText(/Upload a resume before applying to/)).toBeVisible();
  });

  test("persists themes, loads additional pages, and keeps candidate picker keyboard accessible", async ({ page }) => {
    await page.goto("/");
    const themeTrigger = page.getByRole("button", { name: "Theme: Default" });
    await themeTrigger.click();
    const themeMenu = page.getByRole("menu", { name: "Theme options" });
    await expect(themeMenu).toBeVisible();
    const triggerBox = await themeTrigger.boundingBox();
    const menuBox = await themeMenu.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.y).toBeGreaterThan(triggerBox!.y + triggerBox!.height);
    await page.getByRole("menuitemradio", { name: "Icy Blue Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "icy-blue-dark");
    await page.reload();
    await expect(page.getByRole("button", { name: "Theme: Icy Blue Dark" })).toBeVisible();

    await signIn(page, adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByRole("button", { name: "Theme: Icy Blue Dark" })).toBeVisible();

    await page.getByRole("button", { name: "Add jobs" }).click();
    await expect(page.getByRole("heading", { name: "Job postings" })).toBeVisible();
    const postingCards = page.locator(".admin-jobs-view .posting-card");
    await expect(postingCards).toHaveCount(10);

    await page.locator(".admin-jobs-view").getByRole("button", { name: "Load more" }).click();
    await expect(postingCards).toHaveCount(20);

    const assessButton = postingCards.first().getByRole("button", { name: "Assess a candidate" });
    await assessButton.click();
    const dialog = page.getByRole("dialog", { name: "Analyze candidate" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-describedby", "candidate-picker-description");
    await expect(page.getByPlaceholder("Sydney Nguyen, Alex Chen...")).toBeFocused();
    await expect(dialog.locator(".candidate-option").first()).toBeVisible();

    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.locator(".candidate-option:not([disabled])").last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(assessButton).toBeFocused();
  });

  test("allows admin overview and denies the same endpoint to regular users", async ({ page, request }) => {
    const regularEmail = uniqueEmail("e2e-regular");

    const regularRegistration = await request.post("/api/register", {
      data: {
        name: "Regular E2E User",
        email: regularEmail,
        password: "SecurePass123",
        passwordConfirmation: "SecurePass123"
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
    const usersDenied = await request.get("/api/admin/users", {
      headers: {
        Authorization: `Bearer ${regularSession.token}`
      }
    });
    expect(usersDenied.status()).toBe(403);
    const settingsDenied = await request.get("/api/admin/settings", {
      headers: {
        Authorization: `Bearer ${regularSession.token}`
      }
    });
    expect(settingsDenied.status()).toBe(403);

    const seededJobTitle = `Seeded Veterinary Reception Role ${Date.now()}`;
    if (process.env.DATABASE_URL) {
      await seedResumeVersion({ userId: regularSession.user.id, fileName: "admin-users-resume.md" });
      await seedCompletedApplication({ userId: regularSession.user.id, jobTitle: seededJobTitle });
    }

    await page.goto("/");
    await page.getByPlaceholder("admin@example.com").fill(adminEmail);
    await page.getByPlaceholder("Account password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();

    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.getByRole("heading", { name: "System Health" })).toBeVisible();
    await expect(page.locator(".health-card").filter({ hasText: "PostgreSQL" })).toBeVisible();
    await expect(page.locator(".health-card").filter({ hasText: "pgvector" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Application Instances" })).toBeVisible();
    await expect(page.getByText("app-1", { exact: true })).toBeVisible();
    await expect(page.getByText("app-2", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(page.locator(".admin-settings-view").getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "LLM API style" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Responses" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Chat completions" })).toBeVisible();
    const tlsToggle = page.getByRole("checkbox", { name: "Use implicit TLS" });
    await expect(tlsToggle).toBeVisible();
    const fromName = `E2E Hiring Team ${Date.now()}`;
    await page.getByLabel("From name").fill(fromName);
    const settingsSave = page.waitForResponse((response) =>
      response.url().includes("/api/admin/settings") && response.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "Save settings" }).click();
    expect((await settingsSave).status()).toBe(200);
    await expect(page.getByLabel("From name")).toHaveValue(fromName);

    await page.getByRole("button", { name: "Users" }).click();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await page.getByPlaceholder("client intake, phone triage, anaesthetic monitoring...").fill("client intake");
    await expect(page.locator(".admin-user-card").filter({ hasText: regularEmail })).toBeVisible();
    if (process.env.DATABASE_URL) {
      const userCard = page.locator(".admin-user-card").filter({ hasText: regularEmail });
      await expect(userCard.getByText("admin-users-resume.md")).toBeVisible();
      const adminDownload = page.waitForEvent("download");
      await userCard.getByRole("button", { name: "Download resume" }).click();
      expect((await adminDownload).suggestedFilename()).toBe("resume-v1.md");
      await expect(userCard.getByText(seededJobTitle)).toBeVisible();
      await expect(userCard.locator(".matched-term-chip").filter({ hasText: "client intake" })).toBeVisible();
      const adminApplication = userCard.locator(".application-card").filter({ hasText: seededJobTitle });
      await adminApplication.getByRole("button", { name: new RegExp(seededJobTitle) }).click();
      await expect(adminApplication.getByText("Candidate summary")).toBeVisible();
      await expect(adminApplication.getByText("HR Score Breakdown")).toBeVisible();
      await expect(adminApplication.getByText("Requirement Assessment")).toBeVisible();
      await expect(adminApplication.getByText("Manage client intake and appointment scheduling", { exact: true })).toBeVisible();
      await expect(adminApplication.getByText("Fairness Review")).toBeVisible();
      await expect(adminApplication.getByText("Ranked evidence")).toBeVisible();
      await expect(adminApplication.getByText("Veterinary reception evidence with client intake and scheduling ownership.")).toBeVisible();
      await adminApplication.getByRole("button", { name: "Schedule meeting" }).click();
      const meetingDialog = page.getByRole("dialog", { name: "Schedule meeting" });
      await expect(meetingDialog).toBeVisible();
      await expect(meetingDialog.getByText(regularEmail)).toBeVisible();
      await expect(meetingDialog.locator(".candidate-picker-context").getByText(seededJobTitle)).toBeVisible();
      await expect(meetingDialog.getByLabel("Invite message")).toHaveValue(/Manage client intake, appointment scheduling/);
      await meetingDialog.getByRole("button", { name: "Send invite" }).click();
      await expect(meetingDialog.getByText("Email service is not configured")).toBeVisible();
      await meetingDialog.getByRole("button", { name: "Close" }).click();
      await expect(meetingDialog).not.toBeVisible();
    }

    const postingTitle = `E2E Veterinary Receptionist ${Date.now()}`;
    await page.getByRole("button", { name: "Add jobs" }).click();
    await expect(page.getByRole("heading", { name: "Add job posting" })).toBeVisible();
    await page.getByPlaceholder("Veterinary Receptionist").fill(postingTitle);
    await page.getByPlaceholder("Type a skill and press Enter").fill("client intake");
    await page.getByRole("button", { name: "Add skill" }).click();
    await page.getByPlaceholder("Type a skill and press Enter").fill("phone triage");
    await page.keyboard.press("Enter");
    await page
      .getByPlaceholder("Paste the job posting requirements, responsibilities, and qualifications.")
      .fill("Manage appointment scheduling, client intake, EFTPOS payments, phone triage, and urgent visit coordination.");
    await page.getByRole("button", { name: "Publish job posting" }).click();

    await expect(page.getByText("Job posting saved and selected for analysis.")).toBeVisible();
    const postingCard = page.locator(".posting-card").filter({ hasText: postingTitle });
    await expect(postingCard).toBeVisible();
    await expect(postingCard.locator(".tag-chip").filter({ hasText: "client intake" })).toBeVisible();

    await page.getByRole("button", { name: "Jobs", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find roles" })).toBeVisible();
    await page
      .getByPlaceholder("appointment scheduling, client intake, anaesthetic monitoring...")
      .fill("client intake");
    const searchResult = page.locator(".posting-card").filter({ hasText: postingTitle });
    await expect(searchResult).toBeVisible();
    await expect(searchResult.getByText("0 applications", { exact: true })).toBeVisible();
    await expect(searchResult.getByRole("button", { name: "0 applications" })).toHaveCount(0);
    await expect(searchResult.getByRole("button", { name: "Assess a candidate" })).toBeVisible();
  });

  test("downloads assessments, edits interview questions, and converts candidate assessments", async ({ page, request }) => {
    test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required to seed candidate assessments.");

    const candidateEmail = uniqueEmail("e2e-assessment-candidate");
    const password = "SecurePass123";
    const postingTitle = `E2E Candidate Assessment ${Date.now()}`;

    const candidateRegistration = await request.post("/api/register", {
      data: {
        name: "Candidate Assessment User",
        email: candidateEmail,
        password,
        passwordConfirmation: password
      }
    });
    expect(candidateRegistration.status()).toBe(201);
    const candidateSession = await candidateRegistration.json();
    await seedResumeVersion({ userId: candidateSession.user.id, fileName: "candidate-assessment-resume.md" });

    const adminLogin = await request.post("/api/login", {
      data: {
        email: adminEmail,
        password: adminPassword
      }
    });
    expect(adminLogin.status()).toBe(200);
    const adminSession = await adminLogin.json();
    const postingResponse = await request.post("/api/admin/job-postings", {
      headers: {
        Authorization: `Bearer ${adminSession.token}`
      },
      data: {
        title: postingTitle,
        description: "Assess client intake, appointment scheduling, phone triage, and calm reception communication.",
        skills: ["client intake", "phone triage"]
      }
    });
    expect(postingResponse.status()).toBe(201);
    const { jobPosting } = await postingResponse.json();

    const assessmentJobId = await seedCompletedApplication({
      userId: candidateSession.user.id,
      jobTitle: postingTitle,
      jobDescription: jobPosting.description,
      resumeFileName: "candidate-assessment-resume.md",
      recommendation: "Invite the candidate for a structured reception interview.",
      analysisKind: "candidate_assessment",
      jobPostingId: jobPosting.id
    });

    await page.goto("/");
    await signIn(page, adminEmail, adminPassword);
    await expect(page).toHaveURL(/\/applications$/);

    await page.getByRole("button", { name: "Jobs", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find roles" })).toBeVisible();
    await page
      .getByPlaceholder("appointment scheduling, client intake, anaesthetic monitoring...")
      .fill(postingTitle);
    const linkedPostingCard = page.locator(".posting-card").filter({ hasText: postingTitle });
    await expect(linkedPostingCard).toBeVisible();
    const linkedApplicationsButton = linkedPostingCard.getByRole("button", { name: "1 applications" });
    await expect(linkedApplicationsButton).toBeVisible();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await linkedApplicationsButton.click();
    const scrollAfter = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(8);
    const postingApplications = page.locator(".posting-applications-panel").filter({ hasText: postingTitle });
    await expect(postingApplications.getByText(candidateEmail)).toBeVisible();

    await page.getByRole("button", { name: "Applications", exact: true }).click();
    await expect(page).toHaveURL(/\/applications$/);
    await page.getByPlaceholder("client intake, phone triage, animal handling, veterinary technician...").fill(postingTitle);

    const assessmentCard = page.locator(".application-card").filter({ hasText: postingTitle });
    await expect(assessmentCard).toBeVisible();
    await expect(assessmentCard.getByText("Candidate assessment", { exact: true })).toBeVisible();
    await expect(assessmentCard.getByText(candidateEmail)).toBeVisible();
    const assessmentSummary = assessmentCard.getByRole("button", { name: new RegExp(postingTitle) });
    if (await assessmentSummary.getAttribute("aria-expanded") !== "true") {
      await assessmentSummary.click();
    }

    const assessmentDownload = page.waitForEvent("download");
    await assessmentCard.getByRole("button", { name: "Download assessment" }).click();
    expect((await assessmentDownload).suggestedFilename()).toBe(
      `assessment-${assessmentJobId}-${postingTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`
    );

    const questionEditor = assessmentCard.locator(".interview-question-editor");
    await questionEditor.fill("How do you prioritize simultaneous phone and front-desk requests?");
    await assessmentCard.getByRole("button", { name: "Save questions" }).click();
    await expect(assessmentCard.getByText("Saved")).toBeVisible();
    await expect(questionEditor).toHaveValue("How do you prioritize simultaneous phone and front-desk requests?");

    await assessmentCard.getByRole("button", { name: "Convert to application" }).click();
    await expect(assessmentCard.getByText("Application", { exact: true })).toBeVisible();
    await expect(assessmentCard.getByText("Candidate assessment", { exact: true })).not.toBeVisible();
    await expect(assessmentCard.getByRole("button", { name: "Convert to application" })).not.toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, candidateEmail, password);
    await expect(page).toHaveURL(/\/applications$/);
    await page.getByPlaceholder("client intake, phone triage, animal handling, veterinary technician...").fill(postingTitle);
    const candidateApplication = page.locator(".application-card").filter({ hasText: postingTitle });
    await expect(candidateApplication).toBeVisible();
    const candidateApplicationSummary = candidateApplication.getByRole("button", { name: new RegExp(postingTitle) });
    if (await candidateApplicationSummary.getAttribute("aria-expanded") !== "true") {
      await candidateApplicationSummary.click();
    }
    await expect(candidateApplication.getByText("Candidate summary")).toBeVisible();
    await expect(candidateApplication.getByText("How do you prioritize simultaneous phone and front-desk requests?")).not.toBeVisible();
  });

  test("expands profile applications with stored analysis details", async ({ page, request }) => {
    test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required to seed stored applications.");

    const email = uniqueEmail("e2e-application-details");
    const password = "SecurePass123";
    const jobTitle = `Seeded Veterinary Reception Role ${Date.now()}`;

    const registration = await request.post("/api/register", {
      data: {
        name: "Application Details User",
        email,
        password,
        passwordConfirmation: password
      }
    });
    expect(registration.status()).toBe(201);
    const session = await registration.json();
    await seedResumeVersion({ userId: session.user.id, fileName: "application-details-resume.md" });
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
    await expect(application.getByText("Manage client intake and appointment scheduling", { exact: true })).toBeVisible();
    await expect(application.getByText("Fairness Review")).toBeVisible();
    await expect(application.getByText("The assessment ignored identity and location clues.")).toBeVisible();
    await expect(application.getByText("Managed client intake").first()).toBeVisible();
    await expect(application.getByText("Confirm emergency triage confidence")).toBeVisible();
    await expect(application.getByText("Lead with reception workflow ownership", { exact: true })).toBeVisible();
    await expect(application.getByText("Ranked evidence")).toBeVisible();
    await expect(application.getByText("Veterinary reception evidence with client intake and scheduling ownership.")).toBeVisible();
  });
});
