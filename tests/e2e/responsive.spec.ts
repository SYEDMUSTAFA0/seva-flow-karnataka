import { expect, test } from "@playwright/test";
import { loginAs, USERS } from "./helpers";

const WIDTHS = [360, 390, 768, 1024, 1440];

async function noHorizontalOverflow(page: import("@playwright/test").Page) {
  const metrics = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  // allow ≤2px for sub-pixel rounding
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.inner + 2);
}

for (const w of WIDTHS) {
  test(`dashboard + applications render without overflow at ${w}px`, async ({ browser }) => {
    const { context, page } = await loginAs(browser, USERS.inspector);
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await noHorizontalOverflow(page);
    await page.goto("/applications");
    await page.waitForLoadState("networkidle");
    await noHorizontalOverflow(page);
    await context.close();
  });
}

test("field verification page is usable on a phone viewport", async ({ browser }) => {
  const { context, page } = await loginAs(browser, USERS.field);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/applications");
  await noHorizontalOverflow(page);
  // mobile bottom nav exists on small screens
  await expect(page.locator("nav, [class*='bottom']").last()).toBeVisible();
  await context.close();
});
