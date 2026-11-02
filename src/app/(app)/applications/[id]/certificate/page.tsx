import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { getApplicationOrThrow } from "@/lib/services/applications";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatINR } from "@/lib/utils";
import { numberToWordsIndian } from "@/lib/numwords";
import { PrintButton } from "./print-button";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getLanguage();
  const t = await getDict();

  const app = await getApplicationOrThrow(user, id);
  if (!app) notFound();
  if (!app.decision?.certificateNumber) redirect(`/applications/${app.id}`);

  const d = app.decision;
  const a = app.applicant;
  const income = d.approvedIncome ?? app.declaredAnnualIncome;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/applications/${app.id}`} className="flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          {app.referenceNumber}
        </Link>
        <PrintButton label={t.decision.printCertificate} />
      </div>

      {/* Certificate */}
      <div className="print-area relative mx-auto max-w-[760px] border-[3px] border-double border-navy-300 bg-[#fffdf7] p-8 shadow-[var(--shadow-lift)] sm:p-12">
        {/* Demo watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <p className="rotate-[-28deg] select-none text-[64px] font-bold tracking-widest text-navy-900/[0.045]">
            DEMO · ನಮೂನೆ
          </p>
        </div>

        <div className="relative">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-saffron-400 bg-saffron-50 text-xl font-bold text-saffron-600">
              ಕ
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-2">{t.certificate.govt}</p>
            <p className="text-xs text-ink-3">{t.certificate.dept} · {a.taluk} Taluk</p>
            <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-saffron-400 to-transparent" />
            <h1 className="mt-4 text-2xl font-bold tracking-wide text-ink">{t.certificate.title}</h1>
            <p className="mt-0.5 text-sm text-ink-3">ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ · Income Certificate</p>
          </div>

          {/* Meta row */}
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-y border-line py-2.5 text-xs text-ink-3">
            <span>{t.certificate.certNo}: <span className="font-mono font-semibold text-ink">{d.certificateNumber}</span></span>
            <span>{t.certificate.refNo}: <span className="font-mono text-ink-2">{app.referenceNumber}</span></span>
            <span>{t.certificate.issuedOn}: <span className="text-ink-2">{formatDate(d.decidedAt, lang)}</span></span>
          </div>

          {/* Body */}
          <div className="mt-6 space-y-4 text-[15px] leading-8 text-ink-2">
            <p>
              {t.certificate.certifies} <strong className="text-ink">{lang === "kn" && a.fullNameKn ? a.fullNameKn : a.fullName}</strong>
              {a.fatherName && (
                <>, {t.certificate.fatherOf} <strong className="text-ink">{a.fatherName}</strong></>
              )}
              , {t.certificate.residentOf} <strong className="text-ink">{a.addressLine1}, {lang === "kn" && a.villageKn ? a.villageKn : a.village}, {a.taluk} Taluk, {a.district} — {a.pincode}</strong>,
            </p>
            <p>
              {t.certificate.verifiedIncomeIs} <strong className="text-ink">{formatINR(income)}</strong>{" "}
              ({t.certificate.rupees} {numberToWordsIndian(income)} {t.certificate.only}).
            </p>
            <p>
              {t.certificate.purpose}: <strong className="text-ink">{t.purpose[app.purpose as keyof typeof t.purpose] ?? app.purpose}</strong>
              {app.purposeDetails ? ` — ${app.purposeDetails}` : ""}.
            </p>
            <p className="text-[13px] text-ink-3">{t.certificate.validNote}</p>
          </div>

          {/* Signature */}
          <div className="mt-12 flex items-end justify-between">
            <div className="text-xs text-ink-3">
              <p className="rounded border border-amber/40 bg-amber-bg/60 px-2 py-1 font-medium text-amber">
                {t.certificate.demoStamp}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-2 h-10 w-32 border-b border-ink-3/40 font-serif text-lg italic text-navy-700">
                {d.officer.name}
              </div>
              <p className="text-xs font-medium text-ink">{d.officer.name}</p>
              <p className="text-[11px] text-ink-3">{t.certificate.digitallySigned} · {t.certificate.deputyTahsildar}</p>
              <p className="text-[11px] text-ink-3">{a.taluk} Taluk, {a.district}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="no-print mt-4 text-center text-xs text-ink-3">{t.decision.certificateIssuedNote}</p>
    </div>
  );
}
