"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FileUp,
  MapPin,
  MessageSquareWarning,
  RefreshCcw,
  RotateCcw,
  Scan,
  Trash2,
  Upload,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import {
  advanceStageAction,
  deleteDocumentAction,
  requestDocumentsAction,
  verifyDocumentAction,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DocStatusBadge } from "@/components/stage-badge";
import { safeJson, cn, formatBytes } from "@/lib/utils";
import { STAGES } from "@/lib/constants";

interface DocRow {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
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

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export function DocumentsClient({
  applicationId,
  canVerify,
  canUpload,
  canAdvance,
  canReturn,
  checklist,
  extraDocs,
}: {
  applicationId: string;
  canVerify: boolean;
  canUpload: boolean;
  canAdvance: boolean;
  canReturn: boolean;
  checklist: Row[];
  extraDocs: DocRow[];
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(
    checklist.find((r) => r.document)?.documentType ?? null
  );
  const [verifyTarget, setVerifyTarget] = useState<{ doc: DocRow; status: "VERIFIED" | "INVALID" | "NEEDS_CLARIFICATION" } | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState("");
  const [removeTarget, setRemoveTarget] = useState<DocRow | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<DocRow | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [missingSel, setMissingSel] = useState<string[]>([]);
  const [explanationKn, setExplanationKn] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<{ documentType: string; documentId?: string } | null>(null);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<Record<string, { pct: number; error?: string }>>({});
  const [imgZoom, setImgZoom] = useState<number | null>(null); // null = fit

  const selectedRow = checklist.find((r) => r.documentType === selectedType) ?? null;
  const previewDoc = selectedRow?.document ?? null;

  const counts = useMemo(() => {
    let missing = 0, pendingReview = 0, verified = 0, optional = 0;
    for (const r of checklist) {
      const satisfied = r.alternativeOf ? r.groupSatisfied : !!r.document;
      if (!r.required) { optional++; continue; }
      if (!satisfied) { missing++; continue; }
      if (r.document?.verificationStatus === "VERIFIED") verified++;
      else if (r.document) pendingReview++;
    }
    return { missing, pendingReview, verified, optional };
  }, [checklist]);

  const missingRows = checklist.filter((r) => r.required && !r.document && !(r.alternativeOf && r.groupSatisfied));

  // ─── Upload via XHR for real progress ─────────────────────────────────────

  const pickFile = (documentType: string, documentId?: string) => {
    pendingRef.current = { documentType, documentId };
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  const sendFile = useCallback(
    (file: File, target: { documentType: string; documentId?: string }) => {
      const key = target.documentId ?? target.documentType;
      const fd = new FormData();
      fd.set("file", file);
      if (target.documentId) fd.set("documentId", target.documentId);
      else {
        fd.set("applicationId", applicationId);
        fd.set("documentType", target.documentType);
      }
      setUploadState((s) => ({ ...s, [key]: { pct: 0 } }));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/documents/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadState((s) => ({ ...s, [key]: { pct: Math.round((e.loaded / e.total) * 90) } }));
        }
      };
      xhr.onload = () => {
        if (xhr.status < 300) {
          setUploadState((s) => ({ ...s, [key]: { pct: 100 } }));
          toast.success(t.documents.uploadSuccess);
          setSelectedType(target.documentType);
          router.refresh();
          setTimeout(() => setUploadState((s) => { const n = { ...s }; delete n[key]; return n; }), 800);
        } else {
          let msg = t.documents.uploadFailed;
          try { msg = JSON.parse(xhr.responseText).error ?? msg; } catch { /* keep default */ }
          setUploadState((s) => ({ ...s, [key]: { pct: 0, error: msg } }));
        }
      };
      xhr.onerror = () => setUploadState((s) => ({ ...s, [key]: { pct: 0, error: t.documents.uploadFailed } }));
      xhr.send(fd);
    },
    [applicationId, router, t]
  );

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = pendingRef.current;
    if (file && target) sendFile(file, target);
    e.target.value = "";
  };

  const onDropRow = (row: Row) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragRow(null);
    const file = e.dataTransfer.files?.[0];
    if (file && canUpload) sendFile(file, { documentType: row.documentType });
  };

  // ─── Existing actions ─────────────────────────────────────────────────────

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

  const doRemove = () =>
    startTransition(async () => {
      if (!removeTarget) return;
      const res = await deleteDocumentAction(removeTarget.id);
      if (res.ok) {
        toast.success(t.admin.deleted);
        setRemoveTarget(null);
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFileChosen} />

      {/* Checklist — 3/5 */}
      <div className="space-y-5 xl:col-span-3">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{t.documents.checklist}</p>
                <p className="text-xs text-ink-3">{t.documents.checklistHint}</p>
              </div>
              {canUpload && <p className="text-[11px] text-ink-3">{t.documents.fileTypes}</p>}
            </div>
            {/* Dynamic counts */}
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
              {counts.missing > 0 && <span className="chip border-amber/25 bg-amber-bg text-amber">{counts.missing} {t.documents.missingCount}</span>}
              {counts.pendingReview > 0 && <span className="chip border-navy-200 bg-navy-50 text-navy-700">{counts.pendingReview} {t.documents.pendingCount}</span>}
              {counts.verified > 0 && <span className="chip border-forest-200 bg-forest-50 text-forest-700">{counts.verified} {t.documents.verifiedCount}</span>}
              {counts.optional > 0 && <span className="chip border-line-2 text-ink-3">{counts.optional} {t.documents.optionalCount}</span>}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {checklist.map((row) => {
              const satisfied = row.alternativeOf ? row.groupSatisfied : !!row.document;
              const showMissing = row.required && !satisfied;
              const doc = row.document;
              const up = uploadState[row.documentType];
              const verified = doc?.verificationStatus === "VERIFIED";
              const statusLabel = doc
                ? doc.verificationStatus === "PENDING" && doc.extractedData
                  ? t.documents.aiExtractedStatus
                  : doc.verificationStatus === "PENDING"
                    ? t.documents.uploadedStatus
                    : t.docStatus[doc.verificationStatus as keyof typeof t.docStatus]
                : undefined;
              return (
                <li
                  key={row.documentType}
                  onDragOver={canUpload ? (e) => { e.preventDefault(); setDragRow(row.documentType); } : undefined}
                  onDragLeave={canUpload ? () => setDragRow(null) : undefined}
                  onDrop={canUpload ? onDropRow(row) : undefined}
                  className={cn(
                    "px-4 py-3 transition-colors sm:px-5",
                    dragRow === row.documentType && "bg-navy-50/70 outline-2 -outline-offset-2 outline-dashed outline-navy-300",
                    selectedType === row.documentType && "bg-canvas-2/60"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink">
                          {lang === "kn" ? row.labelKn : row.labelEn}
                        </p>
                        {!row.required && <span className="text-[11px] text-ink-3">({t.common.optional})</span>}
                        {row.alternativeOf && <span className="text-[11px] text-navy-500">({t.documents.orGroup})</span>}
                      </div>
                      {doc ? (
                        <button
                          onClick={() => setSelectedType(row.documentType)}
                          className="mt-1 flex flex-wrap items-center gap-1.5 text-left text-xs text-navy-600 hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{doc.originalFilename}</span>
                          <span className="text-ink-3">· {formatBytes(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleDateString(lang === "kn" ? "kn-IN" : "en-IN", { day: "numeric", month: "short" })}</span>
                        </button>
                      ) : (
                        <p className="mt-1 text-xs text-ink-3">{t.documents.missingDoc}</p>
                      )}
                      {doc?.extractedData && (
                        <ExtractedBox raw={doc.extractedData} title={t.documents.aiExtractedTitle} notice={t.documents.aiExtractedNotice} />
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {showMissing ? (
                        <DocStatusBadge status="MISSING" label={t.docStatus.MISSING} />
                      ) : doc ? (
                        <DocStatusBadge status={doc.extractedData && doc.verificationStatus === "PENDING" ? "NEEDS_CLARIFICATION" : doc.verificationStatus} label={statusLabel ?? t.docStatus.PENDING} />
                      ) : (
                        <DocStatusBadge status="PENDING" label={t.common.optional} />
                      )}
                    </div>
                  </div>

                  {/* Upload progress / error */}
                  {up && (
                    <div className="mt-2">
                      {up.error ? (
                        <div className="flex items-center gap-2 rounded-md border border-rose/25 bg-rose-bg px-2.5 py-1.5 text-xs text-rose">
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="flex-1">{up.error}</span>
                          <button className="font-medium underline" onClick={() => setUploadState((s) => { const n = { ...s }; delete n[row.documentType]; return n; })}>
                            {t.documents.retry}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-navy-700">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                            <div className="h-full rounded-full bg-navy-600 transition-all" style={{ width: `${up.pct}%` }} />
                          </div>
                          <span className="w-16 shrink-0 text-right">{up.pct < 100 ? `${t.documents.uploadingFile} ${up.pct}%` : t.documents.uploadSuccess}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row actions */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {doc ? (
                      <Button size="sm" variant="secondary" onClick={() => setSelectedType(row.documentType)}>
                        <Eye className="h-3.5 w-3.5" />
                        {t.documents.preview}
                      </Button>
                    ) : canUpload ? (
                      <Button size="sm" variant="outline" onClick={() => pickFile(row.documentType)}>
                        <Upload className="h-3.5 w-3.5" />
                        {t.documents.uploadDocument}
                      </Button>
                    ) : null}
                    {doc && canUpload && !verified && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setReplaceTarget(doc)} title={t.documents.replaceConfirm}>
                          <RefreshCcw className="h-3.5 w-3.5" />
                          {t.documents.replace}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(doc)} title={t.documents.removeConfirm}>
                          <Trash2 className="h-3.5 w-3.5 text-rose" />
                          {t.documents.remove}
                        </Button>
                      </>
                    )}
                    {!doc && canUpload && (
                      <span className="hidden text-[10px] text-ink-3 sm:inline">{t.documents.dragHint}</span>
                    )}
                    {canVerify && doc && !verified && (
                      <span className="ml-auto flex gap-1">
                        <button
                          onClick={() => setVerifyTarget({ doc, status: "VERIFIED" })}
                          className="rounded-md border border-forest-200 bg-forest-50 p-1.5 text-forest-600 hover:bg-forest-100"
                          title={t.documents.verify}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setVerifyTarget({ doc, status: "INVALID" })}
                          className="rounded-md border border-rose/20 bg-rose-bg p-1.5 text-rose hover:bg-rose/10"
                          title={t.documents.markInvalid}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setVerifyTarget({ doc, status: "NEEDS_CLARIFICATION" })}
                          className="rounded-md border border-amber/25 bg-amber-bg p-1.5 text-amber hover:bg-amber/10"
                          title={t.documents.requestClarification}
                        >
                          <MessageSquareWarning className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
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
                  <a href={`/api/files/${d.storageKey}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs text-navy-600 hover:underline">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{d.originalFilename}</span>
                    <span className="text-ink-3">· {formatBytes(d.sizeBytes)}</span>
                  </a>
                  <div className="flex items-center gap-1.5">
                    <DocStatusBadge status={d.verificationStatus} label={t.docStatus[d.verificationStatus as keyof typeof t.docStatus]} />
                    {canUpload && d.verificationStatus !== "VERIFIED" && (
                      <button onClick={() => setRemoveTarget(d)} className="rounded-md p-1 text-ink-3 hover:bg-rose-bg hover:text-rose" title={t.documents.remove}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
        <div className="card overflow-hidden xl:sticky xl:top-20">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Eye className="h-4 w-4 shrink-0 text-ink-3" />
                {selectedRow ? (lang === "kn" ? selectedRow.labelKn : selectedRow.labelEn) : t.documents.preview}
              </p>
              {previewDoc && (
                <p className="truncate text-[11px] text-ink-3">
                  {previewDoc.originalFilename} · {formatBytes(previewDoc.sizeBytes)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {previewDoc?.mimeType.startsWith("image/") && (
                <>
                  <button onClick={() => setImgZoom((z) => Math.max(0.5, (z ?? 1) - 0.25))} className="rounded-md p-1.5 text-ink-3 hover:bg-canvas-2" title={t.documents.zoomOut}><ZoomOut className="h-4 w-4" /></button>
                  <button onClick={() => setImgZoom(null)} className="rounded-md p-1.5 text-ink-3 hover:bg-canvas-2" title={t.documents.fitScreen}><Scan className="h-4 w-4" /></button>
                  <button onClick={() => setImgZoom((z) => Math.min(4, (z ?? 1) + 0.25))} className="rounded-md p-1.5 text-ink-3 hover:bg-canvas-2" title={t.documents.zoomIn}><ZoomIn className="h-4 w-4" /></button>
                </>
              )}
              {previewDoc && (
                <a href={`/api/files/${previewDoc.storageKey}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-navy-600 hover:bg-canvas-2 hover:underline">
                  <Download className="h-3.5 w-3.5" />
                  {t.documents.openOriginal}
                </a>
              )}
            </div>
          </div>
          <div className="aspect-[3/4] overflow-hidden bg-canvas-2">
            <AnimatePresence mode="wait">
              {previewDoc ? (
                <motion.div key={previewDoc.storageKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  {previewDoc.mimeType === "application/pdf" ? (
                    <iframe src={`/api/files/${previewDoc.storageKey}`} className="h-full w-full" title={previewDoc.originalFilename} />
                  ) : previewDoc.mimeType.startsWith("image/") ? (
                    <div className="h-full w-full overflow-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${previewDoc.storageKey}`}
                        alt={previewDoc.originalFilename}
                        className={imgZoom === null ? "h-full w-full object-contain" : "max-w-none"}
                        style={imgZoom === null ? undefined : { width: `${Math.round(imgZoom * 100)}%`, height: "auto" }}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
                      {t.documents.noPreview}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <FileUp className="h-8 w-8 text-line-2" />
                  <div>
                    <p className="text-sm font-medium text-ink-2">{t.documents.noDocYet}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {selectedRow ? t.documents.uploadToPreview : t.documents.noDocSelected}
                    </p>
                  </div>
                  {selectedRow && canUpload && (
                    <Button size="sm" variant="outline" onClick={() => pickFile(selectedRow.documentType)}>
                      <Upload className="h-3.5 w-3.5" />
                      {t.documents.uploadDocument}
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {previewDoc?.extractedData && (
            <div className="max-h-56 overflow-y-auto border-t border-line px-4 py-3">
              <ExtractedBox raw={previewDoc.extractedData} title={t.documents.aiExtractedTitle} notice={t.documents.aiExtractedNotice} />
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

      {/* Replace confirm */}
      <Dialog open={!!replaceTarget} onClose={() => setReplaceTarget(null)} title={t.documents.replace} description={replaceTarget?.originalFilename}>
        <div className="space-y-3">
          <p className="text-sm text-ink-2">{t.documents.replaceConfirm}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReplaceTarget(null)}>{t.common.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (replaceTarget) {
                  const row = checklist.find((r) => r.document?.id === replaceTarget.id);
                  pickFile(row?.documentType ?? "OTHER", replaceTarget.id);
                  setReplaceTarget(null);
                }
              }}
            >
              {t.documents.replace}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} title={t.documents.remove} description={removeTarget?.originalFilename}>
        <div className="space-y-3">
          <p className="text-sm text-ink-2">{t.documents.removeConfirm}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>{t.common.cancel}</Button>
            <Button variant="danger" onClick={doRemove} loading={pending}>
              {t.documents.remove}
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
