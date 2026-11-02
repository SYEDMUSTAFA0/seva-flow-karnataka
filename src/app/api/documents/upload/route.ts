import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dictFor, getLanguage } from "@/i18n";
import { AuthError } from "@/lib/auth";
import {
  replaceDocument,
  uploadDocument,
  ValidationError,
} from "@/lib/services/documents";

/**
 * Multipart upload endpoint — used by the checklist's XHR upload so the UI can
 * show real progress (server actions don't stream upload events).
 *
 * Fields:
 *   file          — required
 *   applicationId + documentType — for a new document
 *   documentId                   — replaces the file on an existing document
 */
export async function POST(req: NextRequest) {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: t.errors.unauthenticated }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: t.errors.generic }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: t.errors.generic }, { status: 400 });
  }
  const payload = { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) };

  try {
    const documentId = form.get("documentId");
    if (typeof documentId === "string" && documentId) {
      const doc = await replaceDocument(user, documentId, payload);
      return NextResponse.json({ id: doc.id, replaced: true });
    }
    const applicationId = form.get("applicationId");
    const documentType = form.get("documentType");
    if (typeof applicationId !== "string" || typeof documentType !== "string" || !applicationId || !documentType) {
      return NextResponse.json({ error: t.errors.generic }, { status: 400 });
    }
    const doc = await uploadDocument(user, { applicationId, documentType, file: payload });
    return NextResponse.json({ id: doc.id });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { error: e.reason === "TOO_LARGE" ? t.errors.uploadTooLarge : t.errors.uploadBadType },
        { status: 422 }
      );
    }
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message !== e.code ? e.message : t.errors.forbidden }, { status: 403 });
    }
    console.error(e);
    return NextResponse.json({ error: t.errors.generic }, { status: 500 });
  }
}
