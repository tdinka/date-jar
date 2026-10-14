// One-time email codes for sign-in.
import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_WAIT_SECONDS = 30;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowedEmail(email: string) {
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return allowed.includes(normalizeEmail(email));
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(email: string, code: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function codesMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function sendCode(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Local testing without an email service: show the code in the terminal.
    console.log(`\n[date-jar] Sign-in code for ${email}: ${code}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Date Jar <onboarding@resend.dev>",
      to: [email],
      subject: `${code} is your Date Jar code`,
      text: `Your Date Jar sign-in code is ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Email service error ${res.status}: ${await res.text()}`);
}
