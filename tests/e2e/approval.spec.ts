import { expect, test } from "@playwright/test";
import { createApplicationViaUi, loginAs, USERS } from "./helpers";

/**
 * The assignment's canonical end-to-end flow:
 *   Revenue Inspector creates + advances → Field Officer verifies →
 *   Revenue Inspector recommends → Approving Officer approves → certificate.
 */
test.describe("full approval workflow (3 roles)", () => {
  test("create → scrutiny → field → recommendation → approve → certificate", async ({ browser }) => {
    // ── Revenue Inspector: create + send to scrutiny ──
    const ri = await loginAs(browser, USERS.inspector);
    const appId = await createApplicationViaUi(ri.page);
    await ri.page.getByRole("button", { name: /document scrutiny/i }).click();
    await ri.page.waitForURL(`**/applications/${appId}/documents`);

    // documents page — run the AI document review assistant, then advance
    const aiBtn = ri.page.getByRole("button", { name: /^generate$/i }).first();
    if (await aiBtn.isVisible().catch(() => false)) {
      await aiBtn.click();
      await expect(
        ri.page.getByText(/demo ai mode|AI assistance history \(1\)/i).first()
      ).toBeVisible({ timeout: 30_000 });
    }
    await ri.page.getByRole("button", { name: /proceed to field verification/i }).click();
    await expect(ri.page.getByText(/field verification/i).first()).toBeVisible({ timeout: 20_000 });
    await ri.context.close();

    // ── Field Officer: verify on-site ──
    const fo = await loginAs(browser, USERS.field);
    await fo.page.goto(`/applications/${appId}/verification`);
    // answer all checklist items "Yes"
    const yesButtons = fo.page.getByRole("button", { name: /^yes$|^ಹೌದು$/i });
    const count = await yesButtons.count();
    for (let i = 0; i < count; i++) await yesButtons.nth(i).click();
    // officer notes + editable verification report (submit needs ≥10 chars in the report)
    await fo.page.locator("textarea").first().fill("House visited; applicant present with documents.");
    await fo.page.locator("textarea").nth(2).fill(
      "Visited the residence at Harohalli. Applicant present, address and farmland match the declaration."
    );
    await fo.page.getByRole("button", { name: /^verified$|^ಪರಿಶೀಲಿಸಲಾಗಿದೆ$/i }).first().click();
    await fo.page.getByRole("button", { name: /submit verification report/i }).click();
    await fo.page.getByRole("button", { name: /^confirm$/i }).click();
    await fo.page.waitForURL(`**/applications/${appId}`, { timeout: 30_000 }).catch(() => {});
    await fo.context.close();

    // ── Revenue Inspector: recommendation ──
    const ri2 = await loginAs(browser, USERS.inspector);
    await ri2.page.goto(`/applications/${appId}/recommendation`);
    await ri2.page.getByRole("button", { name: /recommend approval/i }).click();
    await ri2.page.locator("textarea").first().fill("Documents verified; field report satisfactory.");
    await ri2.page.getByRole("button", { name: /submit recommendation/i }).click();
    await ri2.page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(ri2.page.getByText(/final decision|forwarded/i).first()).toBeVisible({ timeout: 20_000 });
    await ri2.context.close();

    // ── Approving Officer: approve ──
    const ao = await loginAs(browser, USERS.approver);
    await ao.page.goto(`/applications/${appId}/decision`);
    await ao.page.getByRole("button", { name: /approve application/i }).click();
    for (const box of await ao.page.locator('input[type="checkbox"]').all()) await box.check();
    await ao.page.getByRole("button", { name: /record|confirm|approve/i }).last().click();
    await expect(ao.page.getByText(/certificate number|ಪ್ರಮಾಣಪತ್ರ ಸಂಖ್ಯೆ/i)).toBeVisible({ timeout: 20_000 });

    // ── Certificate page ──
    await ao.page.goto(`/applications/${appId}/certificate`);
    await expect(ao.page.getByText(/income certificate|ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(ao.page.getByText(/IC\/RAM\/\d{4}\/\d{6}/)).toBeVisible();

    // timeline shows the full journey
    await ao.page.goto(`/applications/${appId}`);
    await expect(ao.page.getByText(/certificate generated|ಪ್ರಮಾಣಪತ್ರ ರಚಿಸಲಾಗಿದೆ/i)).toBeVisible({ timeout: 20_000 });
    await ao.context.close();
  });
});
