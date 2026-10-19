import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { GOOGLE_SCOPE, googleConfigured, redirectUri } from "@/lib/google";

// Starts "Connect Google Calendar": sends the person to Google's consent screen.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) return NextResponse.redirect(new URL("/?calendar=not-set-up", origin));
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("dj_google_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
