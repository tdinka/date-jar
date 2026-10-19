// Free date windows over the next two weeks, in LA time:
// weeknights 6–10pm, weekends 11am–10pm. A window must be free for at least 2.5 hours.
import { busyTimes, type Busy } from "./google";
import { formatLa, laParts, laTime } from "./la-time";

const MIN_MINUTES = 150;

export type FreeSlot = { start: string; end: string; label: string; weekend: boolean };

export function freeWindows(busy: Busy[], now = new Date(), days = 14): FreeSlot[] {
  const out: FreeSlot[] = [];
  for (let d = 0; d < days; d++) {
    const day = laParts(new Date(now.getTime() + d * 864e5));
    const weekend = day.weekday === "Sat" || day.weekday === "Sun";
    let start = laTime(day.year, day.month, day.day, weekend ? 11 : 18);
    const end = laTime(day.year, day.month, day.day, 22);
    if (start < now) start = new Date(Math.ceil(now.getTime() / 1_800_000) * 1_800_000); // next half hour
    if (start >= end) continue;
    // Walk the busy blocks that overlap this window and keep the gaps.
    const blocks = busy.filter((b) => b.end > start && b.start < end).sort((a, b) => +a.start - +b.start);
    let cursor = start;
    for (const b of [...blocks, { start: end, end }]) {
      if ((+b.start - +cursor) / 60_000 >= MIN_MINUTES) {
        out.push({
          start: cursor.toISOString(),
          end: b.start.toISOString(),
          label: `${formatLa(cursor, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} – ${formatLa(b.start, { hour: "numeric", minute: "2-digit" })}`,
          weekend,
        });
      }
      if (b.end > cursor) cursor = b.end;
    }
  }
  return out;
}

export async function freeSlots(days = 14) {
  const now = new Date();
  const busy = await busyTimes(now, new Date(now.getTime() + days * 864e5));
  return freeWindows(busy, now, days);
}
