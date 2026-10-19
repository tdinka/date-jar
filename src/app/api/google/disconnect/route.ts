import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

export async function POST(req: Request) {
  const session = await requireSession();
  await prisma.googleConnection.deleteMany({ where: { userId: session.userId } });
  return NextResponse.redirect(new URL("/?calendar=disconnected", process.env.APP_URL || req.url), { status: 303 });
}
