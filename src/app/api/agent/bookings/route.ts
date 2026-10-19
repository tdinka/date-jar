import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { agentDenied } from "@/lib/agent-auth";

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(["requested", "searching", "awaiting_yes", "booked", "failed", "cancelled"]),
  result: z.string().max(300).optional(),
});

// The check-in updates a booking request as it works on it.
export async function POST(req: Request) {
  const denied = agentDenied(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id, status, result } = parsed.data;
  const booking = await prisma.bookingRequest.update({ where: { id }, data: { status, ...(result !== undefined ? { result } : {}) } });
  if (status === "booked" && booking.ideaId) {
    await prisma.plan.updateMany({ where: { id: "next", ideaId: booking.ideaId }, data: { booking: "Booked" } });
  }
  return NextResponse.json({ ok: true });
}
