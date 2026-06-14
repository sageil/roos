import { expect, test } from "@playwright/test";
import path from "node:path";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass12345";
const resumeFixture = path.resolve("tests/fixtures/resume.md");

const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 100_000)}@example.com`;

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

    await page.goto("/");
    await page.getByPlaceholder("admin@example.com").fill(adminEmail);
    await page.getByPlaceholder("Account password").fill(adminPassword);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Admin Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(regularEmail)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job Postings" })).toBeVisible();
  });
});
