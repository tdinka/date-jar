import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";
import { runTool, tools } from "@/lib/chat-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 6;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
  now: z.string().max(80), // the browser's local date and time, in words
  timeZoneOffsetMinutes: z.number().int().min(-900).max(900), // from Date.getTimezoneOffset()
});

const INSTRUCTIONS = `You are the planning helper inside "Our Date Jar", a private app for a married couple (Tsega and Bonnie) who want to go on a date every two weeks. They live in Westchester, Los Angeles (90045) and will drive about 15 miles: Venice, Culver City, Playa Vista, Marina del Rey, El Segundo, the South Bay beach cities, Inglewood.

What you can do: add ideas to the jar, log a date they went on, set the next date, check free times on the connected Google Calendar (busy/free only), and ask Claude to book the next date.
- When they mention a place or activity they want to try, add it with add_idea and confirm in one short line.
- When they ask for a pick, prefer jar ideas they haven't done recently and match the budget, setting and timing they asked for. You may suggest new ideas from general knowledge; say to check hours and prices, and don't invent specific events or dates.
- Use check_free_times before naming a free time. If no calendar is connected, suggest times and say they can connect Google Calendar in the app.
- Bookings: the Next date card has Find a table buttons (OpenTable, Resy) to book themselves in a few taps. If they want Claude to do it, use request_booking: it only queues the request. Never say a table is booked; Claude looks at the Sunday check-in (or sooner if they ask in the Claude app) and books only after their yes there.
- Only one of them keeps a calendar, so when you suggest a time, remind them to check with each other.
- Keep replies short and warm, in plain text with no markdown headings.`;

export async function POST(req: Request) {
  const session = await readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chat isn't set up yet (no Anthropic API key)." }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { now, timeZoneOffsetMinutes } = parsed.data;

  const [ideas, plan] = await Promise.all([
    prisma.idea.findMany({ where: { status: "jar" }, include: { dates: { select: { date: true }, orderBy: { date: "asc" } } } }),
    prisma.plan.findUnique({ where: { id: "next" } }),
  ]);
  const jar = ideas.map((i) => ({
    id: i.id,
    title: i.title,
    place: i.place || undefined,
    cost: i.cost,
    setting: i.setting,
    needsBooking: i.needsBooking,
    timesDone: i.dates.length,
    lastDone: i.dates.at(-1)?.date.toISOString().slice(0, 10),
  }));
  const state = `Now: ${now}.
Jar (${jar.length} ideas): ${JSON.stringify(jar)}
Next date: ${plan ? JSON.stringify({ title: plan.title, place: plan.place, when: plan.when, booking: plan.booking }) : "none set"}`;

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
  const actions: string[] = [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [
          { type: "text", text: INSTRUCTIONS },
          { type: "text", text: state },
        ],
        tools,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return NextResponse.json({ reply: "I can't help with that one. Try asking another way.", actions });
      }
      if (response.stop_reason !== "tool_use") {
        const reply = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n\n")
          .trim();
        return NextResponse.json({ reply: reply || "Done.", actions });
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const [result, note] = await runTool(block.name, block.input, { userId: session.userId, timeZoneOffsetMinutes });
          actions.push(note);
          results.push({ type: "tool_result", tool_use_id: block.id, content: result });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${(e as Error).message}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ reply: "That took too many steps. Try asking a simpler way.", actions });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Claude is busy. Wait a minute and try again.", actions }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic key rejected");
      return NextResponse.json({ error: "The chat's API key isn't working.", actions }, { status: 502 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${e.status}:`, e.message);
      return NextResponse.json({ error: "Claude couldn't answer just now. Try again.", actions }, { status: 502 });
    }
    throw e;
  }
}
