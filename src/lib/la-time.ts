// Everything date-related in the app happens in Los Angeles time.
export const TIME_ZONE = "America/Los_Angeles";

// Minutes to add to LA wall-clock time to get UTC, on a given day (handles daylight saving).
function laOffsetMinutes(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((at.getTime() - asUtc) / 60_000);
}

// LA wall-clock time -> real instant.
export function laTime(year: number, month: number, day: number, hour: number, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(guess.getTime() + laOffsetMinutes(guess) * 60_000);
}

// Real instant -> LA calendar parts.
export function laParts(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { year: +p.year, month: +p.month, day: +p.day, weekday: p.weekday as string };
}

export function formatLa(at: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, ...opts }).format(at);
}
