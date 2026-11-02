import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface AuditInput {
  applicationId?: string | null;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: unknown;
  remarks?: string | null;
}

/** Append an immutable audit record. Pass a transaction client when part of a tx. */
export async function logAudit(input: AuditInput, tx?: Tx) {
  const db = tx ?? prisma;
  await db.auditLog.create({
    data: {
      applicationId: input.applicationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      remarks: input.remarks ?? null,
    },
  });
}

export interface TimelineInput {
  applicationId: string;
  actorId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  remarks?: string | null;
  remarksKn?: string | null;
}

/** Citizen-facing timeline entry (status history). */
export async function addTimeline(input: TimelineInput, tx?: Tx) {
  const db = tx ?? prisma;
  await db.applicationTimeline.create({
    data: {
      applicationId: input.applicationId,
      actorId: input.actorId ?? null,
      action: input.action,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      remarks: input.remarks ?? null,
      remarksKn: input.remarksKn ?? null,
    },
  });
}

/** Convenience: audit + timeline in one call. */
export async function recordChange(
  input: AuditInput & { timelineAction?: string; remarksKn?: string | null; applicationId: string },
  tx?: Tx
) {
  await logAudit(input, tx);
  await addTimeline(
    {
      applicationId: input.applicationId,
      actorId: input.actorId,
      action: input.timelineAction ?? input.action,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      remarks: input.remarks,
      remarksKn: input.remarksKn,
    },
    tx
  );
}

export async function notify(
  input: {
    userId: string;
    applicationId?: string | null;
    titleEn: string;
    titleKn: string;
    bodyEn?: string;
    bodyKn?: string;
  },
  tx?: Tx
) {
  const db = tx ?? prisma;
  await db.notification.create({ data: { ...input, applicationId: input.applicationId ?? null } });
}
