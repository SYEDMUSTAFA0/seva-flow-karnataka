"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MapPin,
  MessageSquareWarning,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import {
  advanceStageAction,
  requestDocumentsAction,
  uploadDocumentAction,
  verifyDocumentAction,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DocStatusBadge } from "@/components/stage-badge";
import { safeJson, cn } from "@/lib/utils";
import { STAGES } from "@/lib/constants";

interface DocRow {
  id: string;
  originalFilename: string;
  mimeType: string;
  uploadedAt: string;
  verificationStatus: string;
  extractedData: string | null;
  storageKey: string;
}

interface Row {
  documentType: string;
  labelEn: string;
  labelKn: string;
  required: boolean;
  alternativeOf: string | null;
  groupSatisfied?: boolean;
  document: DocRow | null;
}

export function DocumentsClient({
  applicationId,
  canVerify,
  canUpload,
  canAdvance,
  canReturn,
  checklist,
  extraDocs,
  docTypeOptions,
}: {
  applicationId: string;
  stage: string;
  canVerify: boolean;
  canUpload: boolean;
  canAdvance: boolean;
  canReturn: boolean;
  checklist: Row[];
  extraDocs: DocRow[];
  docTypeOptions: { value: string; label: string }[];
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [preview, setPreview] = useState<DocRow | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<{ doc: DocRow; status: "VERIFIED" | "INVALID" | "NEEDS_CLARIFICATION" } | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [missingSel, setMissingSel] = useState<string[]>([]);
  const [explanationKn, setExplanationKn] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState(docTypeOptions[0]?.value ?? "OTHER");

  const doVerify = () =>
    startTransition(async () => {
      if (!verifyTarget) return;
      const res = await verifyDocumentAction(verifyTarget.doc.id, verifyTarget.status, verifyRemarks || undefined);
      if (res.ok) {
        toast.success(t.docStatus[verifyTarget.status]);
        setVerifyTarget(null);
        setVerifyRemarks("");
        router.refresh();
      } else toast.error(res.error);
    });

  const doAdvance = () =>
    startTransition(async () => {
      const res = await advanceStageAction(applicationId, STAGES.FIELD_VERIFICATION);
      if (res.ok) {
        toast.success(t.stage.FIELD_VERIFICATION);
        router.push(`/applications/${applicationId}/verification`);
      } else toast.error(res.error);
    });

  const doReturn = () =>
    startTransition(async () => {
      const res = await requestDocumentsAction(applicationId, {
        missingTypes: missingSel,
        explanationKn,
      });
      if (res.ok) {
        toast.success(t.stage.RETURNED);
        setReturnOpen(false);
        router.push(`/applications/${applicationId}`);
      } else toast.error(res.error);
    });

  const doUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("documentType", uploadType);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadDocumentAction(fd);
      if (res.ok) {
        toast.success(t.documents.uploadSuccess);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const missingRows = checklist.filter((r) => r.required && !r.document && !(r.alternativeOf && r.groupSatisfied));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      {/* Checklist — 3/5 */}
      <div className="space-y-5 xl:col-span-3">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <p className="text-sm font-semibold text-ink">{t.documents.checklist}</p>
            <p className="text-xs text-ink-3">{t.documents.checklistHint}</p>
          </div>
          <ul className="divide-y divide-line">
            {checklist.map((row) => {
              const satisfied = row.alternativeOf ? row.groupSatisfied : !!row.document;
              const showMissing = row.required && !satisfied;
              return (
                <li key={row.documentType} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">
                          {lang === "kn" ? row.labelKn : row.labelEn}
                        </p>
                        {!row.required && <span className="text-[11px] text-ink-3">({t.common.optional})</span>}
                        {row.alternativeOf && <span className="text-[11px] text-navy-500">({t.common.or} group)</span>}
                      </div>
                      {row.document ? (
                        <button
                          onClick={() => setPreview(row.document)}
                          className="mt-1 flex items-center gap-1.5 text-xs text-navy-600 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {row.document.originalFilename}
                          <Eye className="h-3 w-3" />
                        </button>
                      ) : (
                        <p className="mt-1 text-xs text-ink-3">{t.documents.missingDoc}</p>
                      )}
                      {/* AI extracted data */}
                      {row.document?.extractedData && (
                        <ExtractedBox raw={row.document.extractedData} title={t.documents.aiExtractedTitle} notice={t.documents.aiExtractedNotice} />
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {showMissing ? (
                        <DocStatusBadge status="MISSING" label={t.docStatus.MISSING} />
                      ) : row.document ? (
                        <DocStatusBadge status={row.document.verificationStatus} label={t.docStatus[row.document.verificationStatus as keyof typeof t.docStatus]} />
                      ) : (
                        <DocStatusBadge status="PENDING" label={t.common.optional} />
                      )}
                      {canVerify && row.document && row.document.verificationStatus !== "VERIFIED" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setVerifyTarget({ doc: row.document!, status: "VERIFIED" })}
                            className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"
                            title={t.documents.verify}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setVerifyTarget({ doc: row.document!, status: "INVALID" })}
                            className="rounded-md border border-rose/20 bg-rose-bg p-1.5 text-rose hover:bg-rose/10"
                            title={t.documents.markInvalid}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setVerifyTarget({ doc: row.document!, status: "NEEDS_CLARIFICATION" })}
                            className="rounded-md border border-amber/25 bg-amber-bg p-1.5 text-amber hover:bg-amber/10"
                            title={t.documents.requestClarification}
                          >
                            <MessageSquareWarning className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Extra docs */}
        {extraDocs.length > 0 && (
          <div className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <p className="text-sm font-semibold text-ink">{t.docType.OTHER}</p>
            </div>
            <ul className="divide-y divide-line">
              {extraDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <button onClick={() => setPreview(d)} className="flex min-w-0 items-center gap-1.5 text-xs text-navy-600 hover:underline">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{d.originalFilename}</span>
                  </button>
                  <DocStatusBadge status={d.verificationStatus} label={t.docStatus[d.verificationStatus as keyof typeof t.docStatus]} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload */}
        {canUpload && (
          <form onSubmit={doUpload} className="card flex flex-wrap items-end gap-3 p-4">
            <div className="w-56 flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-3">{t.documents.selectDocType}</label>
              <select className="input-base" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                {docTypeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="w-56 flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-3">{t.documents.chooseFile}</label>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.svg,.webp" required className="input-base file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-navy-700" />
            </div>
            <Button type="submit" variant="secondary" loading={pending}>
              <Upload className="h-4 w-4" />
              {t.documents.uploadDocument}
            </Button>
          </form>
        )}

        {/* Stage actions */}
        {(canAdvance || canReturn) && (
          <div className="flex flex-wrap gap-2">
            {canAdvance && (
              <Button variant="primary" onClick={doAdvance} loading={pending}>
                <MapPin className="h-4 w-4" />
                {t.documents.proceedToField}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {canReturn && (
              <Button variant="secondary" onClick={() => { setMissingSel(missingRows.map((r) => r.documentType)); setReturnOpen(true); }}>
                <RotateCcw className="h-4 w-4" />
                {t.documents.requestFromApplicant}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Preview pane — 2/5 */}
      <div className="xl:col-span-2">
        <div className="card sticky top-20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Eye className="h-4 w-4 text-ink-3" />
              {t.documents.preview}
            </p>
            {preview && (
              <a href={`/api/files/${preview.storageKey}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-navy-600 hover:underline">
                <Download className="h-3 w-3" />
                {t.documents.openOriginal}
              </a>
            )}
          </div>
          <div className="aspect-[3/4] bg-canvas-2">
            <AnimatePresence mode="wait">
              {preview ? (
                <motion.div key={preview.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  {preview.mimeType === "application/pdf" ? (
                    <iframe src={`/api/files/${preview.storageKey}`} className="h-full w-full" title={preview.originalFilename} />
                  ) : preview.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/${preview.storageKey}`} alt={preview.originalFilename} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
                      {t.documents.noPreview}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
                  {t.documents.preview} — {t.documents.missingDoc}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {preview?.extractedData && (
            <div className="max-h-56 overflow-y-auto border-t border-line px-4 py-3">
              <ExtractedBox raw={preview.extractedData} title={t.documents.aiExtractedTitle} notice={t.documents.aiExtractedNotice} />
            </div>
          )}
        </div>
      </div>

      {/* Verify dialog */}
      <Dialog
        open={!!verifyTarget}
        onClose={() => setVerifyTarget(null)}
        title={verifyTarget ? t.docStatus[verifyTarget.status] : ""}
        description={verifyTarget?.doc.originalFilename}
      >
        <div className="space-y-3">
          <textarea
            value={verifyRemarks}
            onChange={(e) => setVerifyRemarks(e.target.value)}
            placeholder={t.common.remarksPlaceholder}
            rows={3}
            className="input-base"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setVerifyTarget(null)}>{t.common.cancel}</Button>
            <Button variant={verifyTarget?.status === "INVALID" ? "danger" : "primary"} onClick={doVerify} loading={pending}>
              {t.common.confirm}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Return-for-info dialog */}
      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} title={t.documents.requestFromApplicant} wide>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-3">{t.documents.checklist}</p>
            <div className="flex flex-wrap gap-1.5">
              {checklist.filter((r) => r.required).map((r) => (
                <label
                  key={r.documentType}
                  className={cn(
                    "chip cursor-pointer transition-colors",
                    missingSel.includes(r.documentType)
                      ? "border-rose/30 bg-rose-bg text-rose"
                      : "border-line-2 text-ink-3 hover:border-line"
                  )}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={missingSel.includes(r.documentType)}
                    onChange={(e) =>
                      setMissingSel((s) =>
                        e.target.checked ? [...s, r.documentType] : s.filter((x) => x !== r.documentType)
                      )
                    }
                  />
                  {lang === "kn" ? r.labelKn : r.labelEn}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-3">{t.documents.missingDocExplanation}</label>
            <textarea
              value={explanationKn}
              onChange={(e) => setExplanationKn(e.target.value)}
              rows={3}
              className="input-base lang-kn"
              placeholder="ದಯವಿಟ್ಟು ಈ ದಾಖಲೆಗಳನ್ನು ಸಲ್ಲಿಸಿ…"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReturnOpen(false)}>{t.common.cancel}</Button>
            <Button variant="primary" onClick={doReturn} loading={pending} disabled={missingSel.length === 0 || !explanationKn.trim()}>
              {t.stage.RETURNED}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function ExtractedBox({ raw, title, notice }: { raw: string; title: string; notice: string }) {
  const data = safeJson<Record<string, string>>(raw, {});
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-navy-100 bg-navy-50/50 px-2.5 py-2">
      <p className="mb-1 text-[11px] font-semibold text-navy-700">{title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="truncate text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[10px] italic text-ink-3">{notice}</p>
    </div>
  );
}
