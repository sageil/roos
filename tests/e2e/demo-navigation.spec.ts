import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123";
const demoUserEmail = process.env.DEMO_USER_EMAIL || "priya.patel@example.com.au";
const demoUserPassword = process.env.DEMO_USER_PASSWORD || "DemoUserPassword123";

const signIn = async (page: Page, email: string, password: string) => {
  await page.getByPlaceholder("admin@example.com").fill(email);
  await page.getByPlaceholder("Account password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test.describe.serial("demo seeded navigation", () => {
  test("preserves an admin deep link across sign-in and refresh", async ({ page }) => {
    await page.goto("/admin/users");
    await signIn(page, adminEmail, adminPassword);

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator(".admin-users-view").getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByText(demoUserEmail, { exact: true })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator(".admin-users-view").getByRole("heading", { name: "Users" })).toBeVisible();
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
      page.locator(".application-card").filter({ hasText: "Front Desk Receptionist - Veterinary Clinic" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).not.toBeVisible();
  });
});
