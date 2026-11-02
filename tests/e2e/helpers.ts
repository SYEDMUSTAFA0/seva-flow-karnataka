import type { Browser, BrowserContext, Page } from "@playwright/test";

export const USERS = {
  field: "field@sevaflow.kar",
  inspector: "inspector@sevaflow.kar",
  approver: "tahsildar@sevaflow.kar",
  admin: "admin@sevaflow.kar",
} as const;
export const PASSWORD = "seva@123";

export async function loginAs(
  browser: Browser,
  email: string,
  lang: "en" | "kn" = "en"
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "sf_lang", value: lang, url: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  ]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|ಸೈನ್ ಇನ್/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  return { context, page };
}

/** Creates an application through the real form; returns the new app id. */
export async function createApplicationViaUi(page: Page): Promise<string> {
  await page.goto("/applications/new");
  await page.getByLabel(/full name/i).first().fill("Puttamma E2E");
  await page.getByLabel(/mobile number/i).fill("9876540001");
  await page.getByLabel(/address line 1/i).fill("17, Temple Street, Harohalli");
  await page.getByLabel(/village/i).fill("Harohalli");
  await page.getByLabel(/taluk/i).fill("Kanakapura");
  await page.getByLabel(/pin code/i).fill("562112");
  await page.getByLabel(/declared annual income/i).fill("96000");
  await page.getByRole("button", { name: /create application/i }).click();
  await page.waitForURL(/\/applications\/[a-f0-9-]{36}/, { timeout: 30_000 });
  return page.url().split("/applications/")[1].replace(/\/.*$/, "");
}
