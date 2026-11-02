# Seva Flow Karnataka — ಸೇವಾ ಫ್ಲೋ ಕರ್ನಾಟಕ

**ಸರಳ ಸೇವೆ. ವೇಗದ ನಿರ್ಧಾರ. ಪಾರದರ್ಶಕ ಆಡಳಿತ.**
*Simple service. Faster decisions. Transparent governance.*

An AI-assisted government workflow management platform for Karnataka Revenue Department officers, built around the **income certificate application** process. Kannada-first, mobile-ready for field staff, with AI assistance at every stage — and the officer always in charge of the final decision.

> **Prototype notice:** This is a workflow-management prototype built for a technical assignment. It is **not an official Karnataka government portal**. All applicant data is fictional. Where an official procedure could not be verified precisely, this README marks it as an *illustrative workflow assumption*.

---

## Live demo

| | |
|---|---|
| **App** | <https://seva-flow-karnataka.vercel.app> |
| **Repository** | <https://github.com/SYEDMUSTAFA0/seva-flow-karnataka> |
| **Password (all demo accounts)** | `seva@123` |

| Demo account | Role | What to try |
|---|---|---|
| `inspector@sevaflow.kar` | Revenue Inspector | Full queue → open an application → run AI document review → verify documents → advance stages |
| `field@sevaflow.kar` | Field Officer (Kanakapura) | Assigned field-verification files → mobile visit form → AI-drafted field report |
| `tahsildar@sevaflow.kar` | Approving Officer | Files in *Final decision* → approve → printable certificate; reject/return on others |
| `admin@sevaflow.kar` | Administrator | Audit log, settings, permission matrix |

Hosted on Vercel with a managed PostgreSQL (Neon) database; AI runs in the clearly-labelled deterministic **demo provider** unless `AI_PROVIDER` + API key are configured.

---

## Table of contents

1. [The problem](#1-the-problem)
2. [Who uses it](#2-who-uses-it)
3. [The service: Karnataka income certificate](#3-the-service-karnataka-income-certificate)
4. [The workflow](#4-the-workflow)
5. [AI assistance](#5-ai-assistance)
6. [Impact measurement](#6-impact-measurement)
7. [Technical architecture](#7-technical-architecture)
8. [Local setup](#8-local-setup)
9. [Environment variables](#9-environment-variables)
10. [Demo credentials](#10-demo-credentials)
11. [Testing](#11-testing)
12. [Deployment](#12-deployment)
13. [Repository map](#13-repository-map)

---

## 1. The problem

Revenue-department staff process citizen applications through paper files, manual document checks, repeated data entry, phone calls, and systems that do not talk to each other. The consequences:

- applications sit unexamined for days because nobody sees a prioritized queue;
- missing documents are discovered late, forcing letters/phone calls and re-visits;
- field officers revisit the same address because earlier findings were not recorded;
- officers cannot see an application's full history without opening a physical file;
- applicants get no usable status visibility;
- senior officers have no view of workload, ageing files, or verification quality.

**Seva Flow** gives each officer a single workspace: a prioritized queue, a document checklist, a mobile-first field-verification form, AI assistance that reads the file *before* the officer does, and a final decision screen that keeps the human firmly in charge.

## 2. Who uses it

| Role | Who they are | What they do in Seva Flow |
|---|---|---|
| **Field Officer** (ಗ್ರಾಮ ಲೆಕ್ಕಿಗ / ಕ್ಷೇತ್ರ ಅಧಿಕಾರಿ) | Village Accountant / Village Administrative Officer / field staff | Sees only applications assigned to them, conducts the on-site visit on a phone-friendly form, captures GPS, notes and photos, submits a verification report |
| **Revenue Inspector** (ಕಂದಾಯ ನಿರೀಕ್ಷಕ) | Scrutinises applications and supervises field work | Creates/records applications, verifies documents, returns incomplete files, submits an officer recommendation |
| **Approving Officer** (ಅನುಮೋದಕ ಅಧಿಕಾರಿ) | Deputy Tahsildar / Tahsildar — the signing authority | Reviews the complete file, takes the final decision (approve / reject / return), issues the certificate |
| **Administrator** (ನಿರ್ವಾಹಕ) | Office IT/admin staff | Views the audit log, users, and permission matrix |

Permissions are enforced **on the server** (never just hidden in the UI) — e.g. a field officer cannot open the decision screen or the audit log even by guessing the URL.

## 3. The service: Karnataka income certificate

The income certificate (ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ) is issued by the Revenue Department, commonly required for scholarships, fee concessions, EWS reservations, and government schemes.

### Research sources

- **Tumakuru district administration** — service page describing online/offline application, the ₹15 online charge, operator forwarding, **physical verification by the Village Accountant / Revenue Inspector**, case-worker update, and signing by the **Deputy Tahsildar / Tahsildar**, with endorsement on rejection. `tumkur.nic.in/en/service/apply-for-income-certificate/`
- **Sakala (Karnataka's service-guarantee scheme)** — revenue-department service listings and the citizen status/call-centre model that inspired our timeline + notification design. `sakala.kar.nic.in`
- **ServiceOnline portal** — income-certificate service description including a ~30-day delivery period (excluding holidays) and example enclosures. `serviceonline.gov.in`
- Nadakacheri / Seva Sindhu references for the citizen-facing channel context.

### Verified vs. illustrative

| Verified from official sources | Illustrative prototype assumption |
|---|---|
| VA/RI-level physical verification of residence/income | Exact checklist questions asked during the visit |
| Deputy Tahsildar / Tahsildar is the signing authority | The specific document checklist (Aadhaar, ration card, income proof / self-declaration, photo) |
| Applications can be approved, rejected, or returned for correction | The 30-day *internal* target used for the priority score — Sakala timelines exist but were not reproduced verbatim; we use a neutral "internal target" and never claim a legal deadline |
| A fee is charged online (₹15 reported) | Fee collection is out of scope for this prototype |
| Rejection produces an endorsement/recorded reason | Certificate layout and reference-number format are demo conventions |

The seeded applicants, villages, incomes and documents are **entirely fictional** and labelled as demo data inside the UI.

## 4. The workflow

Eight stages, each with a Kannada status, server-enforced permissions, and full audit history.

| Stage | Status (KN) | What happens |
|---|---|---|
| 1. Received | ಅರ್ಜಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ | Officer reviews the application, sees the document checklist and AI document-review assistant, requests missing documents or begins scrutiny |
| 2. Document scrutiny | ದಾಖಲೆ ಪರಿಶೀಲನೆ | Per-document verify / invalid / needs-clarification / missing, AI extraction + cross-document comparison, then proceed to field verification or return to applicant |
| 3. Field verification | ಸ್ಥಳ ಪರಿಶೀಲನೆ | Mobile-first visit form: date, GPS capture, yes/no checklist, officer notes, photo evidence, AI-generated editable report, outcome + submit |
| 4. Officer recommendation | ಅಧಿಕಾರಿಯ ಶಿಫಾರಸು | Inspector sees the whole file + AI case summary, writes a recommendation (approve / reject / more verification) with bilingual remarks |
| 5. Final decision | ಅಂತಿಮ ನಿರ್ಧಾರ | Approving officer only: approve → unique certificate number + printable certificate; reject → mandatory reason; return → Kannada explanation for the applicant |
| 6. Approved | ಅನುಮೋದಿಸಲಾಗಿದೆ | Printable, reference-numbered income certificate (clearly watermarked DEMO) |
| 7. Returned | ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಅಗತ್ಯವಿದೆ | Missing items + Kannada explanation recorded; resubmission re-enters scrutiny and is counted |
| 8. Rejected | ತಿರಸ್ಕರಿಸಲಾಗಿದೆ | Reason + remarks preserved; full history remains readable |

Every transition writes an **immutable audit record** and a **citizen-readable timeline entry**, notifies the next assignee, and re-assigns the application to the right role for the next stage.

## 5. AI assistance

AI is a first-class citizen but **strictly advisory**:

| Assistant | Where | What it does |
|---|---|---|
| Document extraction | Documents page | Pulls key fields from each uploaded document into a reviewable table |
| Document comparison | Documents page | Cross-checks names, incomes and addresses across documents; flags mismatches (the seed deliberately includes discrepancies for you to see) |
| Missing-information check | Documents / detail page | Compares the configured requirement list to what's actually uploaded |
| Field report | Field verification | Turns rough officer notes into a structured, **editable** report |
| Case summary | Detail / recommendation | Concise Kannada/English case brief for the reviewing officer |
| Decision support | Decision page | Verified facts, outstanding concerns, suggested next action — never a verdict |

**Design guarantees**

- **Structured output only** — every task returns a Zod-validated JSON schema: `summary, findings, inconsistencies, missingInfo, suggestedNextAction, questions, confidence, requiresHumanVerification, extractedFields, draftText`.
- **Real context** — the provider receives the *actual* application, applicant, document metadata and field report; nothing is hardcoded.
- **Provider abstraction** — `AI_PROVIDER=openai` or `gemini` with the matching key calls the real API through a strict-JSON prompt; otherwise a clearly-labelled **demo provider** returns deterministic, context-derived output so the app works fully offline. Demo mode is always visibly badged in the UI.
- **Safety** — prompts forbid deciding eligibility, inventing facts, or treating extracted data as verified. AI-extracted fields are rendered with a distinct "AI-extracted" legend vs. officer-verified.
- **Human control** — every AI text is editable; every suggestion requires explicit officer confirmation; **AI never advances a stage or makes a decision**. Officer edits/overrides are recorded in the audit trail for the override-rate metric.
- **Auditability** — every AI run persists an `AIInteraction` row (task, provider, model, confidence, full output) plus an `AI_ASSISTANCE` audit event.

## 6. Impact measurement

Defined metrics only — **no invented results**. Each metric below states how it would be measured from data this schema already captures.

| Metric | How measured |
|---|---|
| Average processing time | Mean of `ApplicationTimeline` span, creation → terminal stage |
| Document-review time | Median minutes between `DOCUMENT_SCRUTINY` entry and exit audit events |
| % returned for missing info | `RETURNED` decisions ÷ total decisions |
| Field visits per application | `FieldVerification` rows per application (re-visits after `RETURNED`) |
| % within internal target | Terminal applications where elapsed ≤ `internalTargetDate` |
| Officer satisfaction | Periodic survey — outside system scope |
| AI override rate | `AIInteraction.officerOverride = true` ÷ AI interactions (tracked) |
| AI extraction accuracy | Officer edits to extracted fields ÷ extractions (tracked via document verification corrections) |

## 7. Technical architecture

```
Next.js 16 (App Router, Turbopack) ─┬─ Server Components render every page
                                    ├─ Server Actions mutate state (Zod-validated)
                                    ├─ src/lib/services/* — business logic + permission checks
                                    ├─ Prisma 7 driver adapters
                                    ├─ AI provider abstraction (demo | OpenAI | Gemini)
                                    └─ PGlite (embedded WASM Postgres) in dev / adapter-pg in prod
```

- **Language:** TypeScript strict, React 19, Tailwind 4 design tokens (navy/slate/canvas + restrained saffron/forest accents), Framer Motion micro-interactions, Lucide icons.
- **Database:** PostgreSQL semantics everywhere. `DB_MODE=embedded` runs real Postgres in-process via **PGlite** — zero local services, single-user, data in `.data/pglite`. `DB_MODE=server` switches to `DATABASE_URL` through `@prisma/adapter-pg` (managed Postgres / docker-compose).
- **Migrations:** `prisma/migrations/0001_init/migration.sql` generated from `schema.prisma`; applied by `db:setup` (embedded) or `prisma migrate deploy` (server).
- **Auth:** bcrypt-hashed passwords, 7-day opaque session tokens (SHA-256 + server secret, HttpOnly+SameSite cookie), route protection via `src/proxy.ts` fast-path plus per-page/action checks.
- **RBAC:** role → permission map in `src/lib/constants.ts`; every mutation re-checks permission, ownership, and stage legality inside transactions.
- **Storage:** pluggable backend (`src/lib/storage-core.ts`) — local filesystem under `STORAGE_DIR` in embedded/dev mode, or file bytes inside Postgres (`StoredObject` table) when `DB_MODE=server` / `STORAGE_BACKEND=db`, which is what the Vercel deployment uses since serverless hosts have no persistent filesystem. Files stream through the authenticated route `/api/files/[...key]`; an S3-compatible adapter can drop in behind the same API.
- **i18n:** centralized dictionaries (`src/i18n/en.ts` canonical + `kn.ts`), Kannada default via `sf_lang` cookie + `Noto Sans Kannada`, server-rendered `<html lang>`; no hardcoded strings in components.
- **Auditability:** `AuditLog` (immutable; no update/delete paths exist) + `ApplicationTimeline` written inside each mutation's transaction.

## 8. Local setup

```bash
npm install            # installs deps + runs prisma generate
cp .env.example .env   # defaults work out of the box (demo AI, embedded DB)
npm run db:setup       # creates .data/pglite, applies the migration
npm run db:seed        # 24 fictional applications, 5 officers, documents, history
npm run dev            # http://localhost:3000
```

Reset everything: `npm run db:reset` (wipes `.data`, re-applies migration, re-seeds).

> Windows/macOS/Linux — no Docker, no Postgres install needed for development.

## 9. Environment variables

See `.env.example` for the fully commented file.

| Variable | Default | Purpose |
|---|---|---|
| `DB_MODE` | `embedded` | `embedded` = in-process PGlite; `server` = use `DATABASE_URL` |
| `DATABASE_DIR` | `./.data/pglite` | Embedded DB files |
| `DATABASE_URL` | — | Postgres DSN for `DB_MODE=server` |
| `STORAGE_DIR` | `./.data/storage` | Uploaded documents |
| `SESSION_SECRET` | change-me | Session-token HMAC secret (rotate in prod) |
| `AI_PROVIDER` | `demo` | `demo` / `openai` / `gemini` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | — / `gpt-4o-mini` | Live AI |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | — / `gemini-2.0-flash` | Live AI |

## 10. Demo credentials

All accounts share the password **`seva@123`** (fictional users; demo only).

| Email | Role | Try |
|---|---|---|
| `field@sevaflow.kar` | Field Officer (Kanakapura) | `/applications` → assigned file → `/verification` (mobile) |
| `field2@sevaflow.kar` | Field Officer (Srirangapatna) | Second taluk assignment |
| `inspector@sevaflow.kar` | Revenue Inspector | Full lifecycle: create → scrutiny → recommend |
| `tahsildar@sevaflow.kar` | Approving Officer | Final decisions + audit log |
| `admin@sevaflow.kar` | Administrator | Settings, users, permission matrix |

The seed creates **24 applications across all eight stages**, including a file with a deliberate name-spelling mismatch and an income mismatch (watch the comparison AI flag them), approved files with certificate numbers, and a returned file awaiting resubmission.

## 11. Testing

```bash
npm run test         # Vitest — 35 tests
npm run test:e2e     # Playwright — 17 tests (dev server on :3000)
npm run typecheck    # tsc --noEmit — clean
npm run lint         # eslint — clean
npm run build        # production build — clean
```

- **Unit:** permission/transition matrix, AI schema + provider guardrails, utils (INR, Indian number-to-words, reference formats).
- **Integration:** real migrated PGlite per test file — full `RECEIVED → APPROVED` lifecycle with audit assertions, return + resubmission counting, rejection, `RETURN_FOR_CLARIFICATION`, AI run persistence + override tracking, and forbidden-path checks for every privileged action.
- **E2E:** the assignment's canonical journey — login → create → document scrutiny → AI assistance → field verification (mobile form) → recommendation → approval → printable certificate → timeline. Plus return, rejection, RBAC navigation checks, and horizontal-overflow checks at 360 / 390 / 768 / 1024 / 1440 px.

## 12. Deployment

**Production (this repo):** Vercel + Neon Postgres — <https://seva-flow-karnataka.vercel.app>

| Env var | Value |
|---|---|
| `DB_MODE` | `server` |
| `DATABASE_URL` | Neon pooled connection (set by the Vercel Postgres integration) |
| `SESSION_SECRET` | random 32-byte hex |
| `AI_PROVIDER` | `demo` (or `openai`/`gemini` + the matching key) |

Schema + demo data are applied from a dev machine:

```bash
DIRECT_URL=<unpooled-dsn> npx prisma migrate deploy
DB_MODE=server DATABASE_URL=<pooled-dsn> npx tsx prisma/seed.ts
```

**Any Node host + managed Postgres** (Supabase, RDS, docker-compose …): set `DB_MODE=server`, `DATABASE_URL`, `SESSION_SECRET`; run `prisma migrate deploy`, then `npm run build && npm run start`. Uploaded files go to Postgres (`StoredObject`) automatically; set `STORAGE_BACKEND=fs` with a mounted `STORAGE_DIR` volume if you prefer filesystem storage.

`docker-compose.yml` ships a local Postgres 16 service for parity testing (`docker compose up -d postgres`, then `DB_MODE=server`).

## 13. Repository map

```
prisma/            schema, migration, deterministic seed (fictional data)
scripts/           db-setup / db-reset / minpdf (generated seed documents)
src/app/(auth)/    login (Kannada-first)
src/app/(app)/     dashboard, applications/*, verification, recommendation,
                   decision, certificate, audit, settings
src/app/api/files/ authenticated document streaming
src/components/    app shell, stepper, timeline, AI panel, stage badges, ui kit
src/i18n/          en + kn dictionaries, server + client providers
src/lib/           auth, permissions, audit, storage, db, constants, utils
src/lib/actions/   server actions (thin Zod-validated wrappers)
src/lib/services/  application business logic + workflow engine
src/lib/ai/        schemas, provider abstraction, task runner
src/proxy.ts       route protection fast-path
tests/             vitest unit + integration, playwright e2e, PGlite fixtures
```

---

*Built as a Full Stack AI Engineer assignment — Seva Flow Karnataka is a prototype, not an official government service. Citizen-facing government services are available through the official Nadakacheri / Seva Sindhu portals.*
