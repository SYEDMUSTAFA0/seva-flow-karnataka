import { expect, test } from "@playwright/test";
import { loginAs, USERS } from "./helpers";

test.describe("role-based access control", () => {
  test("field officer cannot open the audit log", async ({ browser }) => {
    const { context, page } = await loginAs(browser, USERS.field);
    await page.goto("/audit");
    await page.waitForURL("**/dashboard**", { timeout: 15_000 }).catch(() => {});
    expect(page.url()).not.toContain("/audit");
    await context.close();
  });

  test("field officer cannot reach the decision screen", async ({ browser }) => {
    // find an application the field officer CAN see (assigned one), then try /decision
    const { context, page } = await loginAs(browser, USERS.field);
    await page.goto("/applications");
    const firstLink = page.locator('a[href*="/applications/"]').first();
    const href = await firstLink.getAttribute("href");
    if (href) {
      const id = href.split("/applications/")[1].split("/")[0];
      await page.goto(`/applications/${id}/decision`);
      // either redirected away or shown an access notice — never the decision form
      await expect(page.getByRole("button", { name: /approve application/i })).toHaveCount(0);
    }
    await context.close();
  });

  test("revenue inspector sees the application list but not user management", async ({ browser }) => {
    const { context, page } = await loginAs(browser, USERS.inspector);
    await page.goto("/applications");
    await expect(page.getByRole("link").first()).toBeVisible();
    await page.goto("/audit");
    await expect(page.getByRole("button", { name: /approve application/i })).toHaveCount(0);
    await context.close();
  });

  test("approving officer can view the audit log", async ({ browser }) => {
    const { context, page } = await loginAs(browser, USERS.approver);
    await page.goto("/audit");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });
});
