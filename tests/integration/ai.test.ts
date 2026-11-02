import { beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_APPLICATION, setupTestDb } from "../helpers/testdb";

let users: Awaited<ReturnType<typeof setupTestDb>>["users"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let appId: string;

beforeAll(async () => {
  const db = await setupTestDb();
  users = db.users;
  prisma = db.prisma;
  const { createApplication } = await import("@/lib/services/applications");
  const app = await createApplication(users.inspector, { ...SAMPLE_APPLICATION });
  appId = app.id;
});

describe("AI task execution", () => {
  it("runs a demo AI task, persists the interaction and writes an audit record", async () => {
    const { runAiTask } = await import("@/lib/ai/tasks");
    const { result, interactionId, provider, model } = await runAiTask(
      users.inspector,
      appId,
      "MISSING_INFO",
      "kn"
    );
    expect(provider).toBe("demo");
    expect(model).toContain("demo");
    expect(result.summary.length).toBeGreaterThan(5);
    expect(result.confidence).toBeGreaterThanOrEqual(0);

    const row = await prisma.aIInteraction.findUnique({ where: { id: interactionId } });
    expect(row?.applicationId).toBe(appId);
    expect(row?.officerId).toBe(users.inspector.id);
    expect(JSON.parse(row!.output).summary).toBe(result.summary);

    const audit = await prisma.auditLog.findFirst({
      where: { applicationId: appId, action: "AI_ASSISTANCE", entityId: interactionId },
    });
    expect(audit).not.toBeNull();
  });

  it("blocks AI use for users who cannot view the application", async () => {
    const { runAiTask } = await import("@/lib/ai/tasks");
    // field officer isn't assigned to this application → view-assigned denies
    await expect(runAiTask(users.field, appId, "CASE_SUMMARY", "en")).rejects.toThrow("FORBIDDEN");
  });

  it("records officer overrides of AI output for the override metric", async () => {
    const { runAiTask, markAiOverride } = await import("@/lib/ai/tasks");
    const { interactionId } = await runAiTask(users.inspector, appId, "CASE_SUMMARY", "en");
    await markAiOverride(interactionId, users.inspector);
    const row = await prisma.aIInteraction.findUnique({ where: { id: interactionId } });
    expect(row?.officerOverride).toBe(true);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: interactionId, action: "AI_OVERRIDE" } });
    expect(audit).not.toBeNull();

    // a different officer cannot mark another's interaction
    await expect(markAiOverride(interactionId, users.approver)).rejects.toThrow("FORBIDDEN");
  });
});
