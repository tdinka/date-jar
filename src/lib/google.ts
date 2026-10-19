// Google Calendar, busy/free only (scope calendar.freebusy). Uses plain fetch against Google's endpoints.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "./db";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy openid email";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string) {
  return `${process.env.APP_URL || origin}/api/google/callback`;
}

// Refresh tokens are encrypted with a key derived from SESSION_SECRET.
function key() {
  return createHash("sha256").update(`google-token:${process.env.SESSION_SECRET}`).digest();
}
export function encrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export async function exchangeCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const data = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!data.refresh_token) throw new Error("Google didn't return a refresh token");
  // The id_token came straight from Google over TLS, so reading its email claim without verifying is fine here.
  let email = "";
  try {
    email = JSON.parse(Buffer.from((data.id_token || "").split(".")[1], "base64url").toString()).email || "";
  } catch {}
  return { refreshToken: data.refresh_token, email };
}

async function accessToken(refreshTokenEnc: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: decrypt(refreshTokenEnc),
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) throw new CalendarError("reconnect", "Google Calendar needs reconnecting.");
  if (!res.ok) throw new CalendarError("unavailable", "Google Calendar didn't answer.");
  return ((await res.json()) as { access_token: string }).access_token;
}

export class CalendarError extends Error {
  constructor(public code: "not_connected" | "reconnect" | "unavailable", message: string) {
    super(message);
  }
}

export type Busy = { start: Date; end: Date };

// Busy times across every connected calendar (today that's Tsega's Gmail).
export async function busyTimes(from: Date, to: Date): Promise<Busy[]> {
  if (!googleConfigured()) throw new CalendarError("not_connected", "Google Calendar isn't set up.");
  const links = await prisma.googleConnection.findMany();
  if (!links.length) throw new CalendarError("not_connected", "No Google Calendar is connected.");
  const all: Busy[] = [];
  for (const link of links) {
    const token = await accessToken(link.refreshTokenEnc);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
    });
    if (!res.ok) throw new CalendarError("unavailable", "Google Calendar didn't answer.");
    const data = (await res.json()) as { calendars: Record<string, { busy: { start: string; end: string }[] }> };
    for (const cal of Object.values(data.calendars)) {
      for (const b of cal.busy || []) all.push({ start: new Date(b.start), end: new Date(b.end) });
    }
  }
  return all;
}
