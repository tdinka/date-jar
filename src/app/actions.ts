"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";

const IdeaInput = z.object({
  title: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(400).default(""),
  cost: z.enum(["$", "$$", "$$$"]).default("$$"),
  setting: z.enum(["home", "out"]).default("out"),
  needsBooking: z.boolean().default(false),
});

export async function addIdea(input: z.input<typeof IdeaInput>) {
  const session = await requireSession();
  const data = IdeaInput.parse(input);
  await prisma.idea.create({ data: { ...data, addedById: session.userId } });
  revalidatePath("/");
}

export async function removeIdea(id: string) {
  await requireSession();
  await prisma.idea.update({ where: { id }, data: { status: "archived" } });
  revalidatePath("/");
}

// "We did this": log a date for today (YYYY-MM-DD from the browser, so it's the local day).
export async function logDate(ideaId: string, day: string) {
  await requireSession();
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day);
  await prisma.dateLog.create({ data: { ideaId, date: new Date(`${date}T00:00:00Z`) } });
  revalidatePath("/");
}

export async function makeNextDate(ideaId: string) {
  await requireSession();
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId } });
  const data = { title: idea.title, place: idea.place, ideaId: idea.id, when: null, booking: idea.needsBooking ? "Needs booking" : "" };
  await prisma.plan.upsert({ where: { id: "next" }, update: data, create: { id: "next", ...data } });
  revalidatePath("/");
}

export async function setNextDateTime(when: string | null) {
  await requireSession();
  const parsed = when ? new Date(when) : null;
  if (parsed && Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
  await prisma.plan.update({ where: { id: "next" }, data: { when: parsed } });
  revalidatePath("/");
}

// "Ask Claude to book" for the next date. Claude picks it up and books after a yes in the Claude app.
export async function requestBooking(notes: string) {
  const session = await requireSession();
  const plan = await prisma.plan.findUnique({ where: { id: "next" } });
  if (!plan) throw new Error("No next date");
  const open = await prisma.bookingRequest.findFirst({
    where: { ideaId: plan.ideaId, status: { in: ["requested", "searching", "awaiting_yes"] } },
  });
  if (open) return;
  await prisma.bookingRequest.create({
    data: { ideaId: plan.ideaId, title: plan.title, place: plan.place, when: plan.when, notes: notes.slice(0, 400), requestedById: session.userId },
  });
  revalidatePath("/");
}

export async function cancelBooking(id: string) {
  await requireSession();
  await prisma.bookingRequest.update({ where: { id }, data: { status: "cancelled" } });
  revalidatePath("/");
}

export async function markBooked() {
  await requireSession();
  await prisma.plan.update({ where: { id: "next" }, data: { booking: "Booked" } });
  revalidatePath("/");
}

export async function clearNextDate() {
  await requireSession();
  await prisma.plan.deleteMany({ where: { id: "next" } });
  revalidatePath("/");
}
