import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encrypt, exchangeCode } from "@/lib/google";
import { requireSession } from "@/lib/require-session";

// Google sends the person back here after they allow (or refuse) calendar access.
export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const origin = process.env.APP_URL || url.origin;
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?calendar=${status}`, origin));
    res.cookies.delete("dj_google_state");
    return res;
  };
  const expected = cookies().get("dj_google_state")?.value;
  if (!expected || url.searchParams.get("state") !== expected) return back("error");
  const code = url.searchParams.get("code");
  if (!code) return back("cancelled");
  try {
    const { refreshToken, email } = await exchangeCode(code, url.origin);
    await prisma.googleConnection.upsert({
      where: { userId: session.userId },
      update: { email, refreshTokenEnc: encrypt(refreshToken) },
      create: { userId: session.userId, email, refreshTokenEnc: encrypt(refreshToken) },
    });
    return back("connected");
  } catch (e) {
    console.error(e);
    return back("error");
  }
}
