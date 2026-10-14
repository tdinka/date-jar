import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CODE_MINUTES, RESEND_WAIT_SECONDS, hashCode, isAllowedEmail, newCode, normalizeEmail, sendCode } from "@/lib/otp";

const Body = z.object({ email: z.string().email().max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);

  // Same answer whether or not the email is allowed, so the page doesn't reveal who has access.
  const ok = NextResponse.json({ ok: true });
  if (!isAllowedEmail(email)) return ok;

  const recent = await prisma.loginCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_WAIT_SECONDS * 1000) {
    return NextResponse.json({ error: `Wait ${RESEND_WAIT_SECONDS} seconds before asking for another code.` }, { status: 429 });
  }

  const code = newCode();
  await prisma.loginCode.create({
    data: { email, codeHash: hashCode(email, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) },
  });
  try {
    await sendCode(email, code);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Couldn't send the email. Try again in a minute." }, { status: 502 });
  }
  return ok;
}
