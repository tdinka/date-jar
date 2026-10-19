import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { agentDenied } from "@/lib/agent-auth";
import { CalendarError } from "@/lib/google";
import { freeSlots, type FreeSlot } from "@/lib/free-slots";

export const dynamic = "force-dynamic";

// Everything the check-in needs in one read.
export async function GET(req: Request) {
  const denied = agentDenied(req);
  if (denied) return denied;
  let freeTimes: FreeSlot[] | { error: string } = [];
  try {
    freeTimes = await freeSlots();
  } catch (e) {
    freeTimes = { error: e instanceof CalendarError ? e.message : "Calendar unavailable" };
  }
  const bookings = await prisma.bookingRequest.findMany({
    where: { status: { in: ["requested", "searching", "awaiting_yes"] } },
    orderBy: { createdAt: "asc" },
  });
  const [ideas, plan, lastCheckin, recent] = await Promise.all([
    prisma.idea.findMany({ where: { status: "jar" }, include: { dates: { select: { date: true }, orderBy: { date: "asc" } } } }),
    prisma.plan.findUnique({ where: { id: "next" } }),
    prisma.setting.findUnique({ where: { key: "lastCheckin" } }),
    prisma.dateLog.findMany({ orderBy: { date: "desc" }, take: 10, include: { idea: { select: { title: true } } } }),
  ]);
  return NextResponse.json({
    ideas: ideas.map((i) => ({
      id: i.id,
      title: i.title,
      place: i.place,
      notes: i.notes,
      cost: i.cost,
      setting: i.setting,
      needsBooking: i.needsBooking,
      source: i.source,
      dates: i.dates.map((d) => d.date.toISOString().slice(0, 10)),
    })),
    plan: plan && { title: plan.title, place: plan.place, ideaId: plan.ideaId, when: plan.when, booking: plan.booking },
    lastCheckin: lastCheckin?.value ?? null,
    recentDates: recent.map((r) => ({ title: r.idea.title, date: r.date.toISOString().slice(0, 10) })),
    freeTimes,
    bookings: bookings.map((b) => ({ id: b.id, ideaId: b.ideaId, title: b.title, place: b.place, when: b.when, partySize: b.partySize, notes: b.notes, status: b.status, result: b.result })),
  });
}
