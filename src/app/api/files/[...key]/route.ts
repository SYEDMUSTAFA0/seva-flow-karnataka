import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewApplication, hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/constants";
import { readFile } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

/**
 * Authenticated document streaming.
 * Officers may only stream files belonging to applications they can view.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { key } = await ctx.params;
  const storageKey = key.map(decodeURIComponent).join("/");
  const applicationId = key[0];
  if (!applicationId) return NextResponse.json({ error: "not found" }, { status: 404 });

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, assignedOfficerId: true },
  });
  if (!app || !canViewApplication(user, app)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // field photos are stored under the application too — check doc or fv
  const doc = await prisma.applicationDocument.findFirst({
    where: { applicationId, storageKey },
    select: { id: true, originalFilename: true, mimeType: true },
  });
  let filename = doc?.originalFilename;
  let mime = doc?.mimeType;
  if (!doc) {
    const fv = await prisma.fieldVerification.findUnique({
      where: { applicationId },
      select: { supportingImages: true },
    });
    if (!fv?.supportingImages?.includes(storageKey) && !hasPermission(user, PERMISSIONS.APP_VIEW_ALL)) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    filename = storageKey.split("/").pop();
    mime = MIME[path.extname(storageKey).toLowerCase()] ?? "application/octet-stream";
  }

  const data = await readFile(storageKey);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ext = path.extname(storageKey).toLowerCase();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": mime ?? MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `inline; filename="${(filename ?? "document").replace(/"/g, "")}"`,
    },
  });
}
