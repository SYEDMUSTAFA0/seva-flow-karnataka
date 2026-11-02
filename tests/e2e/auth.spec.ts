import { expect, test } from "@playwright/test";
import { loginAs, USERS } from "./helpers";

test.describe("authentication", () => {
  test("login page renders Kannada-first by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "kn");
    await expect(page.getByText("ಸೇವಾ ಫ್ಲೋ ಕರ್ನಾಟಕ").first()).toBeVisible();
  });

  test("unauthenticated visitors are redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(USERS.inspector);
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: /sign in|ಸೈನ್ ಇನ್/i }).click();
    await expect(page.getByText(/invalid|ತಪ್ಪು/i)).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("valid credentials land on the dashboard", async ({ browser }) => {
    const { context, page } = await loginAs(browser, USERS.inspector);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // dashboard shows real metrics — at least one stat card with a number
    await expect(page.getByText(/pending|applications/i).first()).toBeVisible();
    await context.close();
  });
});
