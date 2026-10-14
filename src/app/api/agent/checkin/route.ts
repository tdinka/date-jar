import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { agentDenied } from "@/lib/agent-auth";

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// Record that the every-other-week check-in ran.
export async function POST(req: Request) {
  const denied = agentDenied(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  await prisma.setting.upsert({
    where: { key: "lastCheckin" },
    update: { value: parsed.data.date },
    create: { key: "lastCheckin", value: parsed.data.date },
  });
  return NextResponse.json({ ok: true });
}
