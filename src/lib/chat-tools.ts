// Tools the chat can use on the jar. Each one checks its own input; Claude's arguments are not trusted as-is.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "./db";
import { freeSlots } from "./free-slots";

type Tool = Anthropic.Beta.BetaTool;

export const tools: Tool[] = [
  {
    name: "add_idea",
    description:
      "Add a date idea to the shared jar. Infer cost, home/out and whether it needs a booking from what they said. Returns the new idea's id.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short, specific, e.g. 'Ramen at Tsujita on Sawtelle'" },
        place: { type: "string", description: "Place or neighbourhood; empty for at-home ideas" },
        notes: { type: "string", description: "One short practical note, optional" },
        cost: { type: "string", enum: ["$", "$$", "$$$"] },
        setting: { type: "string", enum: ["home", "out"] },
        needsBooking: { type: "boolean" },
        fromClaude: { type: "boolean", description: "true when this is your suggestion rather than theirs" },
      },
      required: ["title", "cost", "setting", "needsBooking"],
    },
  },
  {
    name: "log_date",
    description: "Record that they went on a date from the jar. Use the idea id from the jar list. date is YYYY-MM-DD; use today's date if they don't say.",
    input_schema: {
      type: "object",
      properties: { ideaId: { type: "string" }, date: { type: "string" } },
      required: ["ideaId", "date"],
    },
  },
  {
    name: "set_next_date",
    description:
      "Set the couple's next planned date (shown at the top of the app). Use an idea id from the jar; add the idea first if it's new. when is a local date-time like 2026-10-17T19:00, or empty if no time is agreed yet.",
    input_schema: {
      type: "object",
      properties: { ideaId: { type: "string" }, when: { type: "string" } },
      required: ["ideaId"],
    },
  },
  {
    name: "check_free_times",
    description:
      "Free windows from the connected Google Calendar over the next 14 days (weeknights 6-10pm, weekends 11am-10pm, LA time). Returns a list of {start, end, label, weekend}, or an error if no calendar is connected.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "request_booking",
    description:
      "Ask Claude (in the Claude app) to book the current next date. Only when they clearly ask to book. It does NOT book now: Claude looks for a table at the Sunday check-in, or sooner if they ask in the Claude app, and books only after their yes there. Set the next date first.",
    input_schema: {
      type: "object",
      properties: { notes: { type: "string", description: "Anything the booker should know, e.g. 'patio if possible'" } },
    },
  },
];

const AddIdea = z.object({
  title: z.string().trim().min(1).max(120),
  place: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(400).optional().default(""),
  cost: z.enum(["$", "$$", "$$$"]).catch("$$"),
  setting: z.enum(["home", "out"]).catch("out"),
  needsBooking: z.boolean().catch(false),
  fromClaude: z.boolean().optional().default(false),
});
const LogDate = z.object({ ideaId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const SetNext = z.object({ ideaId: z.string().min(1), when: z.string().optional().default("") });

// Runs one tool. Returns [text for Claude, short note to show in the chat].
export async function runTool(name: string, input: unknown, ctx: { userId: string; timeZoneOffsetMinutes: number }): Promise<[string, string]> {
  if (name === "add_idea") {
    const d = AddIdea.parse(input);
    const idea = await prisma.idea.create({
      data: {
        title: d.title,
        place: d.place,
        notes: d.notes,
        cost: d.cost,
        setting: d.setting,
        needsBooking: d.needsBooking,
        source: d.fromClaude ? "claude" : "us",
        addedById: ctx.userId,
      },
    });
    return [JSON.stringify({ id: idea.id }), `Added “${idea.title}” to the jar`];
  }
  if (name === "log_date") {
    const d = LogDate.parse(input);
    const idea = await prisma.idea.findUnique({ where: { id: d.ideaId } });
    if (!idea) throw new Error("No idea with that id");
    await prisma.dateLog.create({ data: { ideaId: idea.id, date: new Date(`${d.date}T00:00:00Z`) } });
    return ["logged", `Logged “${idea.title}” on ${d.date}`];
  }
  if (name === "set_next_date") {
    const d = SetNext.parse(input);
    const idea = await prisma.idea.findUnique({ where: { id: d.ideaId } });
    if (!idea) throw new Error("No idea with that id");
    let when: Date | null = null;
    if (d.when) {
      // Claude gives a local time with no zone; convert using the browser's offset.
      const m = d.when.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!m) throw new Error("when must look like 2026-10-17T19:00");
      const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + ctx.timeZoneOffsetMinutes * 60_000;
      when = new Date(utc);
    }
    const data = { title: idea.title, place: idea.place, ideaId: idea.id, when, booking: idea.needsBooking ? "Needs booking" : "" };
    await prisma.plan.upsert({ where: { id: "next" }, update: data, create: { id: "next", ...data } });
    return ["saved", `Set next date: ${idea.title}`];
  }
  if (name === "check_free_times") {
    const slots = await freeSlots();
    return [JSON.stringify(slots.slice(0, 20)), "Checked the calendar"];
  }
  if (name === "request_booking") {
    const notes = z.object({ notes: z.string().max(400).optional().default("") }).parse(input ?? {}).notes;
    const plan = await prisma.plan.findUnique({ where: { id: "next" } });
    if (!plan) throw new Error("Set the next date first");
    const open = await prisma.bookingRequest.findFirst({ where: { ideaId: plan.ideaId, status: { in: ["requested", "searching", "awaiting_yes"] } } });
    if (!open) {
      await prisma.bookingRequest.create({ data: { ideaId: plan.ideaId, title: plan.title, place: plan.place, when: plan.when, notes, requestedById: ctx.userId } });
    }
    return ["queued", `Asked Claude to book “${plan.title}”`];
  }
  throw new Error(`Unknown tool ${name}`);
}
