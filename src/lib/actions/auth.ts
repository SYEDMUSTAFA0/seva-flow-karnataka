"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { dictFor, getLanguage } from "@/i18n";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const lang = await getLanguage();
  const t = dictFor(lang);

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: t.auth.invalidCredentials };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { role: true },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: t.auth.invalidCredentials };
  }
  if (!user.active) {
    return { error: t.auth.accountDisabled };
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  await logAudit({
    actorId: user.id,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
  });
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
