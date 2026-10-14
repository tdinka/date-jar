import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MAX_ATTEMPTS, codesMatch, hashCode, isAllowedEmail, normalizeEmail } from "@/lib/otp";
import { SESSION_COOKIE, SESSION_DAYS, createSessionToken } from "@/lib/session";

const Body = z.object({ email: z.string().email().max(200), code: z.string().regex(/^\d{6}$/) });
const WRONG = "That code didn't work. Check it, or ask for a new one.";

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from the email." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);
  if (!isAllowedEmail(email)) return NextResponse.json({ error: WRONG }, { status: 401 });

  const login = await prisma.loginCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!login || login.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "That code has expired. Ask for a new one." }, { status: 401 });
  }
  if (!codesMatch(login.codeHash, hashCode(email, parsed.data.code))) {
    await prisma.loginCode.update({ where: { id: login.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  await prisma.loginCode.update({ where: { id: login.id }, data: { usedAt: new Date() } });
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ userId: user.id, email }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
