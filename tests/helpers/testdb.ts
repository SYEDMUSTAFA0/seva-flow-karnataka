import fs from "node:fs/promises";
import path from "node:path";
import type { AuthUser } from "@/lib/permissions";

const ROLE_NAMES: Record<string, { en: string; kn: string }> = {
  FIELD_OFFICER: { en: "Field Officer", kn: "ಕ್ಷೇತ್ರ ಅಧಿಕಾರಿ" },
  REVENUE_INSPECTOR: { en: "Revenue Inspector", kn: "ಕಂದಾಯ ನಿರೀಕ್ಷಕ" },
  APPROVING_OFFICER: { en: "Approving Officer", kn: "ಅನುಮೋದಕ ಅಧಿಕಾರಿ" },
  ADMIN: { en: "Administrator", kn: "ನಿರ್ವಾಹಕ" },
};

/**
 * Applies the real Prisma migration to this file's isolated PGlite database
 * and creates minimal role/user fixtures. Returns AuthUser objects that can
 * be passed straight into service functions.
 */
export async function setupTestDb() {
  const { prisma } = await import("@/lib/db");
  const pglite = (globalThis as { pglite?: { exec(sql: string): Promise<unknown> } }).pglite;
  if (!pglite) throw new Error("PGlite handle not initialised");

  const sql = await fs.readFile(
    path.join(process.cwd(), "prisma", "migrations", "0001_init", "migration.sql"),
    "utf8"
  );
  await pglite.exec(sql);

  for (const [id, names] of Object.entries(ROLE_NAMES)) {
    await prisma.role.create({ data: { id, nameEn: names.en, nameKn: names.kn } });
  }

  async function makeUser(email: string, roleId: keyof typeof ROLE_NAMES): Promise<AuthUser> {
    const u = await prisma.user.create({
      data: {
        email,
        name: `Test ${roleId}`,
        nameKn: `ಟೆಸ್ಟ್`,
        passwordHash: "test-hash",
        roleId,
        taluk: "Kanakapura",
        district: "Ramanagara",
      },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      nameKn: u.nameKn,
      roleId: u.roleId as AuthUser["roleId"],
      roleNameEn: ROLE_NAMES[roleId].en,
      roleNameKn: ROLE_NAMES[roleId].kn,
      taluk: u.taluk,
      district: u.district,
    };
  }

  return {
    prisma,
    users: {
      field: await makeUser("field@test.kar", "FIELD_OFFICER"),
      inspector: await makeUser("inspector@test.kar", "REVENUE_INSPECTOR"),
      approver: await makeUser("approver@test.kar", "APPROVING_OFFICER"),
      admin: await makeUser("admin@test.kar", "ADMIN"),
    },
  };
}

export const SAMPLE_APPLICANT = {
  fullName: "Lakshmamma",
  fullNameKn: "ಲಕ್ಷ್ಮಮ್ಮ",
  fatherName: "Hanumaiah",
  phone: "9876501234",
  addressLine1: "No 42, 3rd Cross, Kanakapura Main Road",
  village: "Harohalli",
  taluk: "Kanakapura",
  district: "Ramanagara",
  pincode: "562112",
};

export const SAMPLE_APPLICATION = {
  applicant: SAMPLE_APPLICANT,
  declaredAnnualIncome: 120000,
  incomeSource: "AGRICULTURE",
  purpose: "SCHOLARSHIP",
};
