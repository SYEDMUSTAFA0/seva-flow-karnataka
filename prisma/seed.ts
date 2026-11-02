/**
 * Deterministic seed for Seva Flow Karnataka.
 *
 * Creates: roles, demo officers (4 roles), document requirements,
 * 24 fictional income-certificate applications spread across every workflow
 * stage, generated PDF/SVG documents, field verifications, recommendations,
 * decisions, timeline + audit history, AI interactions and notifications.
 *
 * All applicant data is fictional. Safe to re-run (upserts throughout).
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { saveFile } from "../src/lib/storage-core";
import { makePdf, makeFieldPhotoSvg } from "../scripts/minpdf";
import {
  DECISIONS,
  DOCUMENT_TYPES,
  FIELD_OUTCOMES,
  RECOMMENDATIONS,
  ROLES,
  STAGES,
} from "../src/lib/constants";
import { formatCertificate, formatReference, seededRng } from "../src/lib/utils";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* optional */
}

const rng = seededRng(20260102);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

const DAY = 86_400_000;
const NOW = new Date();
const daysAgo = (n: number, h = 10) => new Date(NOW.getTime() - n * DAY - h * 3_600_000);

const PASSWORD = "seva@123";

// ─── Static demo data ────────────────────────────────────────────────────────

const DISTRICTS: Array<[string, string, string[]]> = [
  ["Bengaluru Urban", "ಬೆಂಗಳೂರು ನಗರ", ["Bengaluru South", "Bengaluru North", "Anekal"]],
  ["Ramanagara", "ರಾಮನಗರ", ["Ramanagara", "Magadi", "Kanakapura"]],
  ["Mandya", "ಮಂಡ್ಯ", ["Mandya", "Maddur", "Srirangapatna"]],
  ["Mysuru", "ಮೈಸೂರು", ["Mysuru", "Nanjangud", "T. Narasipura"]],
  ["Tumakuru", "ತುಮಕೂರು", ["Tumakuru", "Tiptur", "Kunigal"]],
  ["Kolar", "ಕೋಲಾರ", ["Kolar", "Malur", "Bangarapet"]],
];

const VILLAGES: Array<[string, string, string, string]> = [
  // village en, village kn, district, taluk
  ["Kaggalipura", "ಕಗ್ಗಲಿಪುರ", "Bengaluru Urban", "Bengaluru South"],
  ["Sathanur", "ಸಾತನೂರು", "Ramanagara", "Kanakapura"],
  ["Harohalli", "ಹರೋಹಳ್ಳಿ", "Ramanagara", "Kanakapura"],
  ["Kodiyala", "ಕೊಡಿಯಾಲ", "Mandya", "Srirangapatna"],
  ["Keregodu", "ಕೆರೆಗೊಡು", "Mandya", "Maddur"],
  ["Hootagalli", "ಹೂತಗಲ್ಲಿ", "Mysuru", "Mysuru"],
  ["Bannur", "ಬನ್ನೂರು", "Mysuru", "T. Narasipura"],
  ["Hebbur", "ಹೆಬ್ಬೂರು", "Tumakuru", "Tumakuru"],
  ["Huliyar", "ಹುಳಿಯಾರ್", "Tumakuru", "Tiptur"],
  ["Tekal", "ತೇಕಲ್", "Kolar", "Malur"],
  ["Vemagal", "ವೇಮಗಲ್", "Kolar", "Kolar"],
  ["Byranahalli", "ಬೈರನಹಳ್ಳಿ", "Ramanagara", "Magadi"],
];

const APPLICANTS: Array<{
  en: string;
  kn: string;
  father: string;
  income: number;
  source: string;
  purpose: string;
  photoAlt?: boolean;
}> = [
  { en: "Lakshmanna Gowda", kn: "ಲಕ್ಷ್ಮಣ್ಣ ಗೌಡ", father: "Thimmappa Gowda", income: 118000, source: "AGRICULTURE", purpose: "SCHOLARSHIP" },
  { en: "Manjula Devi", kn: "ಮಂಜುಳಾ ದೇವಿ", father: "Raju Shetty", income: 96000, source: "SELF_EMPLOYED", purpose: "GOVT_SCHEME" },
  { en: "Ramesh Kumar H", kn: "ರಮೇಶ್ ಕುಮಾರ್ ಎಚ್", father: "Hanumanthappa", income: 215000, source: "SALARIED", purpose: "FEE_CONCESSION" },
  { en: "Saraswati M", kn: "ಸರಸ್ವತಿ ಎಂ", father: "Muniraju", income: 78000, source: "DAILY_WAGE", purpose: "SCHOLARSHIP" },
  { en: "Nagaraju B", kn: "ನಾಗರಾಜು ಬಿ", father: "Basavaraju", income: 145000, source: "AGRICULTURE", purpose: "GOVT_SCHEME" },
  { en: "Bhagyamma", kn: "ಭಾಗ್ಯಮ್ಮ", father: "Late Kempaiah", income: 42000, source: "PENSION", purpose: "GOVT_SCHEME" },
  { en: "Mahadevappa S", kn: "ಮಹದೇವಪ್ಪ ಎಸ್", father: "Siddappa", income: 168000, source: "SELF_EMPLOYED", purpose: "EWS_RESERVATION" },
  { en: "Lalitha R", kn: "ಲಲಿತಾ ಆರ್", father: "Ramakrishna", income: 132000, source: "SALARIED", purpose: "SCHOLARSHIP" },
  { en: "Shankarayya H", kn: "ಶಂಕರಯ್ಯ ಎಚ್", father: "Hanumappa", income: 88000, source: "AGRICULTURE", purpose: "GOVT_SCHEME" },
  { en: "Geetha Nayak", kn: "ಗೀತಾ ನಾಯಕ್", father: "Prakash Nayak", income: 305000, source: "SALARIED", purpose: "FEE_CONCESSION" },
  { en: "Puttaswamy", kn: "ಪುಟ್ಟಸ್ವಾಮಿ", father: "Chikkegowda", income: 102000, source: "AGRICULTURE", purpose: "SCHOLARSHIP" },
  { en: "Ratnamma K", kn: "ರತ್ನಮ್ಮ ಕೆ", father: "Late Kariappa", income: 55000, source: "DAILY_WAGE", purpose: "GOVT_SCHEME" },
  { en: "K Venkatesh", kn: "ಕೆ ವೆಂಕಟೇಶ್", father: "Krishnappa", income: 178000, source: "SELF_EMPLOYED", purpose: "EWS_RESERVATION" },
  { en: "Asha Banu", kn: "ಆಶಾ ಬಾನು", father: "Abdul Khader", income: 124000, source: "SELF_EMPLOYED", purpose: "SCHOLARSHIP" },
  { en: "Muthuraju", kn: "ಮುತ್ತುರಾಜು", father: "Madesha", income: 99000, source: "DAILY_WAGE", purpose: "GOVT_SCHEME" },
  { en: "Kaveri N", kn: "ಕಾವೇರಿ ಎನ್", father: "Narayana Swamy", income: 260000, source: "SALARIED", purpose: "FEE_CONCESSION" },
  { en: "Basavaraju T", kn: "ಬಸವರಾಜು ಟಿ", father: "Thimme Gowda", income: 151000, source: "AGRICULTURE", purpose: "GOVT_SCHEME" },
  { en: "Sumithra D", kn: "ಸುಮಿತ್ರಾ ಡಿ", father: "Devaraj", income: 84000, source: "SELF_EMPLOYED", purpose: "SCHOLARSHIP" },
  { en: "Hanumanthappa", kn: "ಹನುಮಂತಪ್ಪ", father: "Virupakshappa", income: 112000, source: "AGRICULTURE", purpose: "GOVT_SCHEME" },
  { en: "Chandrika V", kn: "ಚಂದ್ರಿಕಾ ವಿ", father: "Vasudev", income: 198000, source: "SALARIED", purpose: "FEE_CONCESSION" },
  { en: "Mallikarjun P", kn: "ಮಲ್ಲಿಕಾರ್ಜುನ್ ಪಿ", father: "Panchakshari", income: 137000, source: "SELF_EMPLOYED", purpose: "OTHER" },
  { en: "Roopa S", kn: "ರೂಪಾ ಎಸ್", father: "Suresh Babu", income: 92000, source: "DAILY_WAGE", purpose: "SCHOLARSHIP" },
  { en: "Eeranna D", kn: "ಈರಣ್ಣ ಡಿ", father: "Durgappa", income: 148000, source: "AGRICULTURE", purpose: "GOVT_SCHEME" },
  { en: "Fathima S", kn: "ಫಾತಿಮಾ ಎಸ್", father: "Syed Ahmed", income: 108000, source: "SELF_EMPLOYED", purpose: "SCHOLARSHIP" },
];

// stage plan: [stage, count] — 24 applications total
const STAGE_PLAN: Array<[string, number]> = [
  [STAGES.RECEIVED, 4],
  [STAGES.DOCUMENT_SCRUTINY, 4],
  [STAGES.FIELD_VERIFICATION, 4],
  [STAGES.OFFICER_RECOMMENDATION, 3],
  [STAGES.FINAL_DECISION, 2],
  [STAGES.RETURNED, 2],
  [STAGES.APPROVED, 3],
  [STAGES.REJECTED, 2],
];

// applications with intentional data issues for the AI demo
const MISSING_DOCS_AT = new Set([5, 8]); // DOCUMENT_SCRUTINY idx missing income evidence / photo
const NAME_MISMATCH_AT = new Set([6]); // ration card shows spelling variant
const INCOME_MISMATCH_AT = new Set([9, 15]); // income proof differs from declared

const REJECTION_REASONS = [
  { code: "INCOME_NOT_SUBSTANTIATED", en: "Declared income could not be substantiated", kn: "ಘೋಷಿತ ಆದಾಯವನ್ನು ಪುರಾವೆಯಿಂದ ಸಮರ್ಥಿಸಲಾಗಲಿಲ್ಲ" },
  { code: "INFORMATION_MISMATCH", en: "Applicant information does not match records", kn: "ಅರ್ಜಿದಾರರ ಮಾಹಿತಿ ದಾಖಲೆಗಳಿಗೆ ಹೊಂದುತ್ತಿಲ್ಲ" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Documents go through the shared storage abstraction — filesystem in
// embedded/dev mode, StoredObject rows when seeding a server-mode database.
async function writeDocFile(appId: string, fileName: string, data: Buffer) {
  return saveFile(appId, fileName, data);
}

function docPdf(title: string, fields: Array<[string, string]>): Buffer {
  return makePdf(title, [
    ...fields.map(([k, v]) => `${k}: ${v}`),
    "",
    "Issued under relevant authority. Specimen document.",
  ]);
}

// ─── Seed ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Seva Flow Karnataka…");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Roles
  const roleDefs = [
    { id: ROLES.FIELD_OFFICER, nameEn: "Field Officer", nameKn: "ಕ್ಷೇತ್ರ ಅಧಿಕಾರಿ", description: "Village Accountant / field-level officer — conducts physical verification" },
    { id: ROLES.REVENUE_INSPECTOR, nameEn: "Revenue Inspector", nameKn: "ಕಂದಾಯ ನಿರೀಕ್ಷಕ", description: "Scrutinises documents, reviews field reports, submits recommendations" },
    { id: ROLES.APPROVING_OFFICER, nameEn: "Approving Officer", nameKn: "ಅನುಮೋದಕ ಅಧಿಕಾರಿ", description: "Deputy Tahsildar — certificate signing authority" },
    { id: ROLES.ADMIN, nameEn: "Administrator", nameKn: "ನಿರ್ವಾಹಕ", description: "Manages users, workflow configuration and audit" },
  ];
  for (const r of roleDefs) {
    await prisma.role.upsert({ where: { id: r.id }, update: r, create: r });
  }

  // Users
  const userDefs = [
    { email: "field@sevaflow.kar", name: "Kiran S", nameKn: "ಕಿರಣ್ ಎಸ್", roleId: ROLES.FIELD_OFFICER, taluk: "Kanakapura", district: "Ramanagara" },
    { email: "field2@sevaflow.kar", name: "Manjunath B", nameKn: "ಮಂಜುನಾಥ್ ಬಿ", roleId: ROLES.FIELD_OFFICER, taluk: "Srirangapatna", district: "Mandya" },
    { email: "inspector@sevaflow.kar", name: "Suma R", nameKn: "ಸುಮಾ ಆರ್", roleId: ROLES.REVENUE_INSPECTOR, taluk: "Kanakapura", district: "Ramanagara" },
    { email: "tahsildar@sevaflow.kar", name: "Rekha Patil", nameKn: "ರೇಖಾ ಪಾಟೀಲ್", roleId: ROLES.APPROVING_OFFICER, taluk: "Kanakapura", district: "Ramanagara" },
    { email: "admin@sevaflow.kar", name: "Suresh K", nameKn: "ಸುರೇಶ್ ಕೆ", roleId: ROLES.ADMIN, taluk: null, district: null },
  ];
  const users: Record<string, { id: string }> = {};
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { ...u, passwordHash },
      create: { ...u, passwordHash },
    });
    users[u.email] = user;
  }
  const FO = users["field@sevaflow.kar"].id;
  const FO2 = users["field2@sevaflow.kar"].id;
  const RI = users["inspector@sevaflow.kar"].id;
  const TAH = users["tahsildar@sevaflow.kar"].id;

  // Document requirements (configurable checklist)
  const reqDefs = [
    { documentType: DOCUMENT_TYPES.AADHAAR, labelEn: "Aadhaar card", labelKn: "ಆಧಾರ್ ಕಾರ್ಡ್", required: true, alternativeOf: null, sortOrder: 1 },
    { documentType: DOCUMENT_TYPES.RATION_CARD, labelEn: "Ration card", labelKn: "ಪಡಿತರ ಚೀಟಿ", required: true, alternativeOf: null, sortOrder: 2 },
    { documentType: DOCUMENT_TYPES.INCOME_PROOF, labelEn: "Income proof", labelKn: "ಆದಾಯದ ಪುರಾವೆ", required: true, alternativeOf: "INCOME_EVIDENCE", sortOrder: 3 },
    { documentType: DOCUMENT_TYPES.SELF_DECLARATION, labelEn: "Self-declaration of income", labelKn: "ಆದಾಯದ ಸ್ವಯಂ ಘೋಷಣೆ", required: true, alternativeOf: "INCOME_EVIDENCE", sortOrder: 4 },
    { documentType: DOCUMENT_TYPES.ADDRESS_PROOF, labelEn: "Address proof", labelKn: "ವಿಳಾಸದ ಪುರಾವೆ", required: false, alternativeOf: null, sortOrder: 5 },
    { documentType: DOCUMENT_TYPES.PHOTOGRAPH, labelEn: "Passport photograph", labelKn: "ಪಾಸ್‌ಪೋರ್ಟ್ ಫೋಟೋ", required: true, alternativeOf: null, sortOrder: 6 },
    { documentType: DOCUMENT_TYPES.ID_PROOF, labelEn: "Identity proof", labelKn: "ಗುರುತಿನ ದಾಖಲೆ", required: false, alternativeOf: null, sortOrder: 7 },
  ];
  for (const r of reqDefs) {
    await prisma.documentRequirement.upsert({
      where: { id: `req-${r.documentType}` },
      update: r,
      create: { id: `req-${r.documentType}`, ...r },
    });
  }

  // Clean previous demo applications for reproducibility
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Notification","AIInteraction","AuditLog","ApplicationTimeline","ApplicationDecision","OfficerRecommendation","FieldVerification","DocumentVerification","ApplicationDocument","Application","Applicant" CASCADE`);

  let seq = 100;
  let appIdx = 0;
  let certSeq = 400;

  const timeline = async (
    applicationId: string,
    actorId: string | null,
    action: string,
    previousStatus: string | null,
    newStatus: string | null,
    createdAt: Date,
    remarks?: string
  ) => {
    await prisma.applicationTimeline.create({
      data: { applicationId, actorId, action, previousStatus, newStatus, createdAt, remarks: remarks ?? null },
    });
    await prisma.auditLog.create({
      data: { applicationId, actorId, action, previousStatus, newStatus, createdAt, remarks: remarks ?? null },
    });
  };

  for (const [stage, count] of STAGE_PLAN) {
    for (let i = 0; i < count; i++) {
      const a = APPLICANTS[appIdx % APPLICANTS.length];
      const [vEn, vKn, district, taluk] = VILLAGES[appIdx % VILLAGES.length];
      const districtKn = DISTRICTS.find((d) => d[0] === district)?.[1] ?? district;

      const age =
        stage === STAGES.APPROVED || stage === STAGES.REJECTED ? 20 + Math.floor(rng() * 35)
        : stage === STAGES.RETURNED ? 14 + Math.floor(rng() * 10)
        : 2 + Math.floor(rng() * 26);
      const submittedAt = daysAgo(age, 9 + Math.floor(rng() * 6));
      const resubCount = stage === STAGES.RETURNED && rng() > 0.5 ? 1 : 0;

      const applicant = await prisma.applicant.create({
        data: {
          fullName: a.en,
          fullNameKn: a.kn,
          fatherName: a.father,
          phone: `98${String(45000000 + Math.floor(rng() * 9000000)).slice(0, 8)}`,
          addressLine1: `${100 + Math.floor(rng() * 300)}, ${pick(["Main Road", "1st Cross", "Temple Street", "Fort Road"])}`,
          village: vEn,
          villageKn: vKn,
          hobli: `${vEn} Hobli`,
          taluk,
          district,
          districtKn,
          pincode: `56${2100 + Math.floor(rng() * 900)}`,
          aadhaarLast4: String(1000 + Math.floor(rng() * 9000)),
        },
      });

      const assigned =
        stage === STAGES.FIELD_VERIFICATION ? (district === "Mandya" ? FO2 : FO)
        : stage === STAGES.FINAL_DECISION || stage === STAGES.APPROVED || stage === STAGES.REJECTED ? TAH
        : stage === STAGES.RETURNED ? RI
        : RI;

      const application = await prisma.application.create({
        data: {
          referenceNumber: formatReference(seq++, 2026),
          applicationType: "INCOME_CERTIFICATE",
          applicantId: applicant.id,
          assignedOfficerId: assigned,
          declaredAnnualIncome: a.income,
          incomeSource: a.source,
          purpose: a.purpose,
          purposeDetails: a.purpose === "SCHOLARSHIP" ? "Vidyasiri / post-matric scholarship" : a.purpose === "GOVT_SCHEME" ? "Gruha Lakshmi scheme eligibility" : null,
          currentStage: stage,
          status: stage,
          priority: age > 18 ? "URGENT" : age > 10 ? "HIGH" : age > 5 ? "NORMAL" : "LOW",
          priorityScore: age * 10,
          submittedAt,
          updatedAt: submittedAt,
          internalTargetDate: new Date(submittedAt.getTime() + 21 * DAY),
          resubmissionCount: resubCount,
        },
      });
      const appId = application.id;

      // ── documents ──
      const idx = appIdx;
      const missingIncome = MISSING_DOCS_AT.has(idx) && rng() > 0.4;
      const missingPhoto = MISSING_DOCS_AT.has(idx) && rng() > 0.5;
      const nameMismatch = NAME_MISMATCH_AT.has(idx);
      const incomeMismatch = INCOME_MISMATCH_AT.has(idx);

      const reachedScrutiny = stage !== STAGES.RECEIVED;
      const verified = !([
        STAGES.RECEIVED,
        STAGES.DOCUMENT_SCRUTINY,
        STAGES.RETURNED,
      ] as string[]).includes(stage);

      type DocSeed = {
        type: string;
        file: string;
        title: string;
        fields: Array<[string, string]>;
        extracted: Record<string, string>;
      };
      const docSeeds: DocSeed[] = [
        {
          type: DOCUMENT_TYPES.AADHAAR,
          file: "aadhaar.pdf",
          title: "Aadhaar Card — UIDAI (specimen)",
          fields: [
            ["Name", a.en],
            ["Aadhaar No", `XXXX XXXX ${applicant.aadhaarLast4}`],
            ["Address", `${applicant.addressLine1}, ${vEn}, ${taluk}, ${district}`],
          ],
          extracted: {
            name: a.en,
            idLast4: applicant.aadhaarLast4 ?? "",
            address: `${applicant.addressLine1}, ${vEn}, ${taluk}, ${district}`,
          },
        },
        {
          type: DOCUMENT_TYPES.RATION_CARD,
          file: "ration-card.pdf",
          title: "Ration Card — Food & Civil Supplies (specimen)",
          fields: [
            ["Head of family", nameMismatch ? a.father : a.en],
            ["Member name", nameMismatch ? `${a.en.split(" ")[0]} G` : a.en],
            ["Address", `${vEn}, ${taluk}, ${district}`],
            ["Card type", "BPL / PHH"],
          ],
          extracted: {
            name: nameMismatch ? `${a.en.split(" ")[0]} G` : a.en,
            address: `${vEn}, ${taluk}, ${district}`,
            cardType: "BPL / PHH",
          },
        },
      ];

      if (!missingIncome) {
        const incomeDoc =
          a.source === "SALARIED"
            ? {
                type: DOCUMENT_TYPES.INCOME_PROOF,
                file: "salary-certificate.pdf",
                title: "Employer Salary Certificate (specimen)",
                monthly: Math.round((incomeMismatch ? a.income * 1.6 : a.income) / 12),
              }
            : {
                type: DOCUMENT_TYPES.SELF_DECLARATION,
                file: "self-declaration.pdf",
                title: "Self-declaration of income (specimen)",
                monthly: Math.round(a.income / 12),
              };
        const yearly = incomeDoc.monthly * 12;
        docSeeds.push({
          type: incomeDoc.type,
          file: incomeDoc.file,
          title: incomeDoc.title,
          fields: [
            ["Name", a.en],
            ["Declared monthly income", `Rs. ${incomeDoc.monthly.toLocaleString("en-IN")}`],
            ["Annual income", `Rs. ${yearly.toLocaleString("en-IN")}`],
            ["Occupation", a.source],
          ],
          extracted: {
            name: a.en,
            annualIncome: String(yearly),
            occupation: a.source,
          },
        });
      }

      if (!missingPhoto) {
        docSeeds.push({
          type: DOCUMENT_TYPES.PHOTOGRAPH,
          file: "photograph.svg",
          title: "Passport photograph",
          fields: [],
          extracted: { faceDetected: "true", format: "passport-size" },
        });
      }

      for (const d of docSeeds) {
        const data = d.file.endsWith(".svg")
          ? makeFieldPhotoSvg(`${a.en} — ${d.title}`, 45)
          : docPdf(d.title, d.fields);
        const { storageKey, sizeBytes } = await writeDocFile(appId, d.file, data);
        const doc = await prisma.applicationDocument.create({
          data: {
            applicationId: appId,
            documentType: d.type,
            storageKey,
            originalFilename: d.file,
            mimeType: d.file.endsWith(".svg") ? "image/svg+xml" : "application/pdf",
            sizeBytes,
            uploadedById: null,
            uploadedAt: new Date(submittedAt.getTime() + 3_600_000),
            verificationStatus: verified ? "VERIFIED" : "PENDING",
            extractedData: JSON.stringify(d.extracted),
            extractionDoneAt: new Date(submittedAt.getTime() + 5_400_000),
          },
        });
        if (verified) {
          await prisma.documentVerification.create({
            data: {
              documentId: doc.id,
              officerId: RI,
              status: "VERIFIED",
              remarks: "Checked against original",
              createdAt: daysAgo(Math.max(0, age - 4), 14),
            },
          });
        }
      }

      // mark missing requirement docs explicitly on docs table? Missing docs are
      // computed from requirements vs uploads — no row needed.

      // ── field verification ──
      const reachedField = !([
        STAGES.RECEIVED,
        STAGES.DOCUMENT_SCRUTINY,
      ] as string[]).includes(stage);
      const fieldOfficer = district === "Mandya" ? FO2 : FO;
      if (reachedField) {
        const outcome =
          stage === STAGES.FIELD_VERIFICATION
            ? null
            : idx === 15
              ? FIELD_OUTCOMES.FURTHER_VERIFICATION
              : FIELD_OUTCOMES.VERIFIED;
        const submitted = outcome !== null;
        const fv = await prisma.fieldVerification.create({
          data: {
            applicationId: appId,
            officerId: fieldOfficer,
            scheduledAt: daysAgo(Math.max(0, age - 6), 9),
            visitedAt: submitted ? daysAgo(Math.max(0, age - 5), 11) : null,
            checklistJson: JSON.stringify([
              { key: "applicantPresent", label: "Applicant met in person", answer: submitted ? true : null },
              { key: "residenceConfirmed", label: "Residence confirmed", answer: submitted ? true : null },
              { key: "incomeConsistent", label: "Income consistent with observation", answer: submitted ? outcome !== FIELD_OUTCOMES.FURTHER_VERIFICATION : null },
              { key: "neighbourConfirmed", label: "Neighbours / records corroborate", answer: submitted ? true : null },
            ]),
            rawNotes: submitted
              ? `Visited residence at ${vEn}. Applicant and family present. House is ${pick(["semi-pucca", "pucca", "kutcha"])} with ${pick(["small agricultural land holding", "a petty shop", "livestock"])}. Neighbours confirm residence for ${5 + Math.floor(rng() * 10)} years.`
              : null,
            observations: submitted
              ? `Residence at ${applicant.addressLine1}, ${vEn} confirmed. Applicant ${a.en} present during visit. Observed occupation consistent with declared source (${a.source}). Neighbourhood corroboration obtained.`
              : null,
            observationsKn: submitted
              ? `${vEn} ಗ್ರಾಮದಲ್ಲಿ ನಿವಾಸ ಖಚಿತಪಡಿಸಲಾಗಿದೆ. ಭೇಟಿ ವೇಳೆ ಅರ್ಜಿದಾರರು ಹಾಜರಿದ್ದರು.`
              : null,
            applicantPresent: submitted ? true : null,
            residenceConfirmed: submitted ? true : null,
            incomeConsistent: submitted ? outcome !== FIELD_OUTCOMES.FURTHER_VERIFICATION : null,
            neighbourConfirmed: submitted ? true : null,
            outcome,
            submittedAt: submitted ? daysAgo(Math.max(0, age - 5), 15) : null,
          },
        });
        if (submitted) {
          const photo = makeFieldPhotoSvg(`Visit at ${vEn}`, 140);
          const { storageKey } = await writeDocFile(appId, `field-photo-${fv.id.slice(0, 6)}.svg`, photo);
          await prisma.fieldVerification.update({
            where: { id: fv.id },
            data: { supportingImages: JSON.stringify([storageKey]) },
          });
        }
      }

      // ── recommendation ──
      const reachedReco = ([STAGES.FINAL_DECISION, STAGES.APPROVED, STAGES.REJECTED] as string[]).includes(stage) || (stage === STAGES.RETURNED && resubCount > 0);
      if (reachedReco) {
        await prisma.officerRecommendation.create({
          data: {
            applicationId: appId,
            officerId: RI,
            recommendation:
              stage === STAGES.REJECTED
                ? RECOMMENDATIONS.RECOMMEND_REJECTION
                : stage === STAGES.RETURNED
                  ? RECOMMENDATIONS.RETURN_FOR_VERIFICATION
                  : RECOMMENDATIONS.RECOMMEND_APPROVAL,
            remarks:
              stage === STAGES.REJECTED
                ? "Income evidence does not support the declared amount; discrepancies not resolved."
                : "Documents verified and field report satisfactory. Eligible for issue of certificate.",
            remarksKn: stage === STAGES.REJECTED ? "ಆದಾಯದ ಪುರಾವೆ ಘೋಷಿತ ಮೊತ್ತವನ್ನು ಬೆಂಬಲಿಸುವುದಿಲ್ಲ." : "ದಾಖಲೆಗಳು ಪರಿಶೀಲಿಸಲಾಗಿದೆ ಮತ್ತು ಸ್ಥಳ ವರದಿ ತೃಪ್ತಿಕರವಾಗಿದೆ.",
            aiAssisted: true,
            aiSummary: `Case: ${a.en}, ${vEn}, ${taluk}. Declared income Rs.${a.income.toLocaleString("en-IN")} from ${a.source}. Documents ${verified ? "verified" : "pending"}; field outcome ${reachedField ? "recorded" : "n/a"}.`,
            createdAt: daysAgo(Math.max(0, age - 3), 12),
          },
        });
      }

      // ── decision ──
      if (([STAGES.APPROVED, STAGES.REJECTED] as string[]).includes(stage)) {
        const reason = stage === STAGES.REJECTED ? pick(REJECTION_REASONS) : null;
        await prisma.applicationDecision.create({
          data: {
            applicationId: appId,
            officerId: TAH,
            decision: stage,
            reason: reason?.en ?? null,
            reasonKn: reason?.kn ?? null,
            remarks: stage === STAGES.APPROVED ? "All requirements satisfied. Certificate issued." : "Rejected after review of officer recommendation and field report.",
            approvedIncome: stage === STAGES.APPROVED ? (incomeMismatch ? a.income : a.income) : null,
            certificateNumber: stage === STAGES.APPROVED ? formatCertificate(district, certSeq++) : null,
            decidedAt: daysAgo(Math.max(0, age - 2), 16),
          },
        });
      }
      if (stage === STAGES.RETURNED) {
        await prisma.applicationDecision.create({
          data: {
            applicationId: appId,
            officerId: RI,
            decision: DECISIONS.RETURNED,
            reason: missingIncome ? "Required documents are missing or incomplete" : "Information requires clarification",
            reasonKn: missingIncome
              ? "ಬೇಕಾದ ದಾಖಲೆಗಳು ಕಾಣೆಯಾಗಿವೆ ಅಥವಾ ಅಪೂರ್ಣವಾಗಿವೆ — ದಯವಿಟ್ಟು ಆದಾಯದ ಪುರಾವೆ ಅಥವಾ ಆದಾಯದ ಸ್ವಯಂ ಘೋಷಣೆಯನ್ನು ಸಲ್ಲಿಸಿ."
              : "ಮಾಹಿತಿಗೆ ಸ್ಪಷ್ಟೀಕರಣ ಬೇಕು — ಪಡಿತರ ಚೀಟಿಯ ವಿವರಗಳು ಅರ್ಜಿಗೆ ಸಂಪೂರ್ಣ ಹೊಂದುತ್ತಿಲ್ಲ; ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟಿಸಿ.",
            remarks: missingIncome
              ? "Please submit income proof or a self-declaration of income."
              : "Ration card details do not fully match the application; please clarify.",
            decidedAt: daysAgo(6, 12),
          },
        });
      }

      // ── timeline + audit (compact canonical trail) ──
      const trail: Array<[string, string, string | null, string | null, number]> = [
        ["APPLICATION_CREATED", "Application submitted via Nadakacheri centre", null, STAGES.RECEIVED, age],
      ];
      if (reachedScrutiny) trail.push(["STAGE_CHANGED", "Moved to document scrutiny", STAGES.RECEIVED, STAGES.DOCUMENT_SCRUTINY, age - 1]);
      if (reachedField) trail.push(["STAGE_CHANGED", "Sent for field verification", STAGES.DOCUMENT_SCRUTINY, STAGES.FIELD_VERIFICATION, age - 6]);
      if (reachedReco) trail.push(["RECOMMENDATION_SUBMITTED", "Officer recommendation submitted", STAGES.FIELD_VERIFICATION, STAGES.OFFICER_RECOMMENDATION, age - 3]);
      if (([STAGES.FINAL_DECISION, STAGES.APPROVED, STAGES.REJECTED] as string[]).includes(stage))
        trail.push(["STAGE_CHANGED", "Forwarded for final decision", STAGES.OFFICER_RECOMMENDATION, STAGES.FINAL_DECISION, age - 3]);
      if (stage === STAGES.APPROVED) trail.push(["CERTIFICATE_GENERATED", "Approved — certificate generated", STAGES.FINAL_DECISION, STAGES.APPROVED, age - 2]);
      if (stage === STAGES.REJECTED) trail.push(["DECISION_MADE", "Application rejected", STAGES.FINAL_DECISION, STAGES.REJECTED, age - 2]);
      if (stage === STAGES.RETURNED) trail.push(["RETURNED", "Returned for additional information", STAGES.DOCUMENT_SCRUTINY, STAGES.RETURNED, 6]);
      for (const [action, remarks, prev, next, daysBack] of trail) {
        await timeline(
          appId,
          action === "APPLICATION_CREATED" ? null : next === STAGES.FIELD_VERIFICATION || action === "FIELD_SUBMITTED" ? fieldOfficer : RI,
          action,
          prev,
          next,
          daysAgo(Math.max(0, daysBack), 13),
          remarks
        );
      }

      // ── demo AI interactions for advanced-stage apps ──
      if (reachedReco) {
        await prisma.aIInteraction.create({
          data: {
            applicationId: appId,
            officerId: RI,
            taskType: "CASE_SUMMARY",
            inputRef: JSON.stringify({ applicationId: appId }),
            output: JSON.stringify({
              summary: `${a.en} of ${vEn}, ${taluk} taluk applied for an income certificate for ${a.purpose}. Declared income Rs.${a.income.toLocaleString("en-IN")} (${a.source}). ${verified ? "All required documents verified." : "Documents pending verification."}`,
              findings: [`Declared income: Rs.${a.income.toLocaleString("en-IN")}`, "Field verification completed", "Documents verified"],
              suggestedNextAction: "Proceed to final decision",
              confidence: 0.78,
              missingInfo: [],
              requiresHumanVerification: ["Confirm final income figure against employer certificate"],
            }),
            confidence: 0.78,
            model: "demo-deterministic",
            provider: "demo",
            createdAt: daysAgo(Math.max(0, age - 3), 11),
          },
        });
      }

      appIdx++;
    }
  }

  // ── notifications ──
  const pendingField = await prisma.application.findMany({
    where: { currentStage: STAGES.FIELD_VERIFICATION },
    select: { id: true, referenceNumber: true, assignedOfficerId: true },
  });
  for (const p of pendingField) {
    if (p.assignedOfficerId) {
      await prisma.notification.create({
        data: {
          userId: p.assignedOfficerId,
          applicationId: p.id,
          titleEn: `Field visit pending — ${p.referenceNumber}`,
          titleKn: `ಸ್ಥಳ ಭೇಟಿ ಬಾಕಿ — ${p.referenceNumber}`,
          bodyEn: "An application is waiting for your field verification.",
          bodyKn: "ಅರ್ಜಿಯೊಂದು ನಿಮ್ಮ ಸ್ಥಳ ಪರಿಶೀಲನೆಗಾಗಿ ಕಾಯುತ್ತಿದೆ.",
        },
      });
    }
  }
  const pendingDecision = await prisma.application.count({ where: { currentStage: STAGES.FINAL_DECISION } });
  await prisma.notification.create({
    data: {
      userId: TAH,
      titleEn: `${pendingDecision} applications awaiting final decision`,
      titleKn: `${pendingDecision} ಅರ್ಜಿಗಳು ಅಂತಿಮ ನಿರ್ಧಾರಕ್ಕೆ ಕಾಯುತ್ತಿವೆ`,
      bodyEn: "Files are ready in the decision queue.",
      bodyKn: "ಫೈಲ್‌ಗಳು ನಿರ್ಧಾರ ಸರದಿಯಲ್ಲಿ ಸಿದ್ಧವಾಗಿವೆ.",
    },
  });

  const counts = await prisma.application.groupBy({ by: ["currentStage"], _count: true });
  console.log("Seed complete:", counts.map((c) => `${c.currentStage}:${c._count}`).join("  "));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
