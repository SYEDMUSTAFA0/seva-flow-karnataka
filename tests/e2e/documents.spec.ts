import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createApplicationViaUi, loginAs, USERS, PASSWORD } from "./helpers";
import { makePdf } from "../../scripts/minpdf";

const dir = path.join(process.cwd(), ".e2e-doc-files");
const pdfPath = path.join(dir, "aadhaar-demo.pdf");
const pdf2Path = path.join(dir, "aadhaar-v2.pdf");
const pngPath = path.join(dir, "ration-card-demo.png");
const txtPath = path.join(dir, "note.txt");
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.beforeAll(() => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(pdfPath, makePdf("Aadhaar Demo", ["Fictional demo document", "Applicant: E2E Demo"]));
  fs.writeFileSync(pdf2Path, makePdf("Aadhaar V2", ["Replacement demo document"]));
  fs.writeFileSync(pngPath, PNG_1PX);
  fs.writeFileSync(txtPath, "not a supported document");
});

async function uploadTo(page: import("@playwright/test").Page, rowText: string, file: string) {
  const row = page.locator("li", { hasText: rowText });
  await expect(row.getByRole("button", { name: /upload document/i })).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    row.getByRole("button", { name: /upload document/i }).click(),
  ]);
  await chooser.setFiles(file);
}

test("documents: upload, preview, persistence, replace, remove, validation", async ({ browser }) => {
  const { context, page } = await loginAs(browser, USERS.admin);
  const appId = await createApplicationViaUi(page);
  await page.goto(`/applications/${appId}/documents`);

  // every requirement row exposes an upload action
  const aadhaar = () => page.locator("li", { hasText: "Aadhaar card" });
  const ration = () => page.locator("li", { hasText: "Ration card" });
  await expect(aadhaar().getByRole("button", { name: /upload document/i })).toBeVisible();
  await expect(ration().getByRole("button", { name: /upload document/i })).toBeVisible();

  // 1. PDF upload → checklist updates
  await uploadTo(page, "Aadhaar card", pdfPath);
  await expect(aadhaar().getByText("aadhaar-demo.pdf")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/awaiting verification/i).first()).toBeVisible();

  // 2. PDF preview renders the real file
  await aadhaar().getByRole("button", { name: /preview/i }).click();
  const pdfFrame = page.locator("iframe[title='aadhaar-demo.pdf']");
  await expect(pdfFrame).toBeVisible();
  const pdfSrc = await pdfFrame.getAttribute("src");
  expect(pdfSrc).toMatch(/^\/api\/files\//);

  // 3. image upload + preview + zoom
  await uploadTo(page, "Ration card", pngPath);
  await expect(ration().getByText("ration-card-demo.png")).toBeVisible({ timeout: 20_000 });
  await ration().getByRole("button", { name: /preview/i }).click();
  const img = page.locator("img[alt='ration-card-demo.png']");
  await expect(img).toBeVisible();
  await page.getByTitle(/zoom in/i).click();
  await expect(img).toHaveAttribute("style", /width/);
  await page.getByTitle(/fit/i).click();
  await expect(img).toHaveCSS("object-fit", "contain");

  // 4. persistence after reload
  await page.reload();
  await expect(page.locator("li").getByText("aadhaar-demo.pdf")).toBeVisible();
  await expect(page.locator("li").getByText("ration-card-demo.png")).toBeVisible();

  // 5. replace → same row, new filename
  await aadhaar().getByRole("button", { name: /replace/i }).click();
  const chooserP = page.waitForEvent("filechooser");
  await page.getByRole("dialog").getByRole("button", { name: /replace/i }).click();
  (await chooserP).setFiles(pdf2Path);
  await expect(aadhaar().getByText("aadhaar-v2.pdf")).toBeVisible({ timeout: 20_000 });
  await expect(aadhaar().getByText("aadhaar-demo.pdf")).toHaveCount(0);
  await aadhaar().getByRole("button", { name: /preview/i }).click();
  await expect(page.locator("iframe[title='aadhaar-v2.pdf']")).toBeVisible();

  // 6. remove → row goes back to missing state
  await ration().getByRole("button", { name: /remove/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /remove/i }).click();
  await expect(ration().getByText(/not yet uploaded/i)).toBeVisible({ timeout: 15_000 });
  await expect(ration().getByRole("button", { name: /upload document/i })).toBeVisible();

  // 7. unsupported file type is rejected with a visible error
  await uploadTo(page, "Self-declaration", txtPath);
  await expect(
    page.locator("li", { hasText: "Self-declaration" }).getByText(/only pdf|failed/i)
  ).toBeVisible({ timeout: 15_000 });

  // 8. unauthenticated access to the stored object is denied
  const anon = await browser.newContext();
  const res = await anon.request.get(new URL(pdfSrc!, "http://localhost:3000").pathname);
  expect([401, 403]).toContain(res.status());
  await anon.close();

  await context.close();
});

test("documents: mobile layout at 360px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await context.addCookies([
    { name: "sf_lang", value: "en", url: process.env.E2E_BASE_URL ?? "http://localhost:3000" },
  ]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(USERS.admin);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|ಸೈನ್ ಇನ್/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });

  const appId = await createApplicationViaUi(page);
  await page.goto(`/applications/${appId}/documents`);

  await expect(page.locator("li", { hasText: "Aadhaar card" }).getByRole("button", { name: /upload document/i })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
  await context.close();
});
