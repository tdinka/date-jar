import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { agentDenied } from "@/lib/agent-auth";

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(400).default(""),
  cost: z.enum(["$", "$$", "$$$"]).default("$$"),
  setting: z.enum(["home", "out"]).default("out"),
  needsBooking: z.boolean().default(false),
});

// Add one of Claude's own suggestions to the jar.
export async function POST(req: Request) {
  const denied = agentDenied(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const idea = await prisma.idea.create({ data: { ...parsed.data, source: "claude" } });
  return NextResponse.json({ id: idea.id });
}
