import { expect, test } from "@playwright/test";
import { createApplicationViaUi, loginAs, USERS } from "./helpers";

test.describe("return for additional information", () => {
  test("inspector returns an application, then records resubmission", async ({ browser }) => {
    const ri = await loginAs(browser, USERS.inspector);
    const appId = await createApplicationViaUi(ri.page);
    await ri.page.getByRole("button", { name: /document scrutiny/i }).click();
    await ri.page.waitForURL(`**/applications/${appId}/documents`);

    // return to applicant — pick missing docs + Kannada explanation
    await ri.page.getByRole("button", { name: /request from applicant/i }).click();
    const dialog = ri.page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const cbs = dialog.locator('input[type="checkbox"]');
    if ((await cbs.count()) > 0) await cbs.first().check();
    await dialog.locator("textarea").fill("ಆದಾಯದ ಪುರಾವೆ ಮತ್ತು ಸ್ವಯಂ ಘೋಷಣೆ ಸಲ್ಲಿಸಿ.");
    await dialog.getByRole("button", { name: /returned|ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ|return/i }).click();
    await ri.page.waitForURL(`**/applications/${appId}`, { timeout: 30_000 }).catch(() => {});

    // app should now be RETURNED with a resubmit action available
    await ri.page.goto(`/applications/${appId}`);
    await ri.page.getByRole("button", { name: /record citizen resubmission/i }).click();
    await ri.page.waitForURL(`**/applications/${appId}/documents`, { timeout: 30_000 });
    await ri.context.close();
  });
});

/** Walks an application: scrutiny → field verification → recommendation → final decision. */
async function walkToFinalDecision(browser: Parameters<typeof loginAs>[0], appId: string) {
  // field officer submits a verification
  const fo = await loginAs(browser, USERS.field);
  await fo.page.goto(`/applications/${appId}/verification`);
  const yesButtons = fo.page.getByRole("button", { name: /^yes$|^ಹೌದು$/i });
  for (let i = 0, n = await yesButtons.count(); i < n; i++) await yesButtons.nth(i).click();
  await fo.page.locator("textarea").first().fill("Residence visited.");
  await fo.page
    .locator("textarea")
    .nth(2)
    .fill("Applicant's documents could not be corroborated during the visit.");
  await fo.page.getByRole("button", { name: /^verified$|^unable to verify$/i }).first().click();
  await fo.page.getByRole("button", { name: /submit verification report/i }).click();
  await fo.page.getByRole("button", { name: /^confirm$/i }).click();
  await fo.page.waitForTimeout(1500);
  await fo.context.close();

  // inspector recommends rejection → forwards to final decision
  const ri = await loginAs(browser, USERS.inspector);
  await ri.page.goto(`/applications/${appId}/recommendation`);
  await ri.page.getByRole("button", { name: /recommend rejection/i }).click();
  await ri.page.locator("textarea").first().fill("Findings do not support the declared income.");
  await ri.page.getByRole("button", { name: /submit recommendation/i }).click();
  await ri.page.getByRole("button", { name: /^confirm$/i }).click();
  await ri.page.waitForTimeout(1500);
  await ri.context.close();
}

test.describe("rejection workflow", () => {
  test("approving officer rejects with a reason; timeline records it", async ({ browser }) => {
    const ri = await loginAs(browser, USERS.inspector);
    const appId = await createApplicationViaUi(ri.page);
    await ri.page.getByRole("button", { name: /document scrutiny/i }).click();
    await ri.page.waitForURL(`**/applications/${appId}/documents`);
    await ri.page.getByRole("button", { name: /proceed to field verification/i }).click();
    await ri.page.waitForTimeout(1200);
    await ri.context.close();

    await walkToFinalDecision(browser, appId);

    const ao = await loginAs(browser, USERS.approver);
    await ao.page.goto(`/applications/${appId}/decision`);
    await ao.page.getByRole("button", { name: /reject application/i }).first().click();
    const sel = ao.page.locator("select").first();
    if (await sel.isVisible().catch(() => false)) await sel.selectOption({ index: 1 });
    else await ao.page.getByRole("button", { name: /substantiated|invalid|mismatch/i }).first().click();
    await ao.page.locator("textarea").first().fill("Submitted documents could not be verified.");
    await ao.page.getByRole("button", { name: /record|confirm|reject/i }).last().click();
    await expect(ao.page.getByText(/decision recorded|ನಿರ್ಧಾರ ದಾಖಲಿಸಲಾಗಿದೆ/i).first()).toBeVisible({ timeout: 20_000 });

    await ao.page.goto(`/applications/${appId}`);
    await expect(ao.page.getByText(/rejected|ತಿರಸ್ಕರಿಸಲಾಗಿದೆ/i).first()).toBeVisible({ timeout: 20_000 });
    await ao.context.close();
  });
});
