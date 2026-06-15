import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com.au";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123";
const demoUserEmail = process.env.DEMO_USER_EMAIL || "oscar.roberts@example.com.au";
const demoUserPassword = process.env.DEMO_USER_PASSWORD || "DemoUserPassword123";

const signIn = async (page: Page, email: string, password: string) => {
  await page.getByPlaceholder("admin@example.com.au").fill(email);
  await page.getByPlaceholder("Account password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test.describe.serial("demo seeded navigation", () => {
  test("redirects expired stored sessions to sign in", async ({ page }) => {
    await page.goto("/applications");
    await signIn(page, demoUserEmail, demoUserPassword);
    await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible();

    const storedToken = await page.evaluate(() => window.localStorage.getItem("roos-token"));
    expect(storedToken).toBeTruthy();
    await page.request.post("/api/logout", {
      headers: {
        Authorization: `Bearer ${storedToken}`
      }
    });

    await page.getByRole("button", { name: "Jobs", exact: true }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Session expired. Sign in again.")).toBeVisible();
  });

  test("preserves an admin deep link across sign-in and refresh", async ({ page }) => {
    await page.goto("/admin/users");
    await signIn(page, adminEmail, adminPassword);

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator(".admin-users-view").getByRole("heading", { name: "Users" })).toBeVisible();
    await page.getByPlaceholder("client intake, phone triage, anaesthetic monitoring...").fill(demoUserEmail);
    await expect(page.getByText(demoUserEmail, { exact: true })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator(".admin-users-view").getByRole("heading", { name: "Users" })).toBeVisible();
    await page.getByPlaceholder("client intake, phone triage, anaesthetic monitoring...").fill(demoUserEmail);
    await expect(page.getByText(demoUserEmail, { exact: true })).toBeVisible();
  });

  test("keeps a regular user on the current route after refresh", async ({ page }) => {
    await page.goto("/jobs");
    await signIn(page, demoUserEmail, demoUserPassword);

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { name: "Find roles" })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { name: "Find roles" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).not.toBeVisible();
  });

  test("redirects a regular user away from admin-only routes", async ({ page }) => {
    await page.goto("/admin/users");
    await signIn(page, demoUserEmail, demoUserPassword);

    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible();
    await expect(
      page.locator(".application-card").filter({ hasText: "Veterinarian - Small Animal Practice - Sydney" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).not.toBeVisible();
  });
});
