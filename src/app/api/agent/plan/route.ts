import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { agentDenied } from "@/lib/agent-auth";

const Body = z.object({
  ideaId: z.string().min(1),
  // ISO date-time WITH a UTC offset, e.g. 2026-10-18T19:30:00-07:00; omit or null for "time not set".
  when: z.string().datetime({ offset: true }).nullable().optional(),
  booking: z.enum(["", "Needs booking", "Booked"]).optional(),
});

// Set the next date (the card at the top of the app).
export async function POST(req: Request) {
  const denied = agentDenied(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const idea = await prisma.idea.findUnique({ where: { id: parsed.data.ideaId } });
  if (!idea) return NextResponse.json({ error: "No idea with that id" }, { status: 404 });
  const data = {
    title: idea.title,
    place: idea.place,
    ideaId: idea.id,
    when: parsed.data.when ? new Date(parsed.data.when) : null,
    booking: parsed.data.booking ?? (idea.needsBooking ? "Needs booking" : ""),
  };
  await prisma.plan.upsert({ where: { id: "next" }, update: data, create: { id: "next", ...data } });
  return NextResponse.json({ ok: true });
}
