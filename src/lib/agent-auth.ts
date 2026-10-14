// The Sunday check-in (Claude, running on Tsega's Mac) calls /api/agent/* with a bearer token.
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export function agentDenied(req: Request): NextResponse | null {
  const expected = process.env.AGENT_TOKEN || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (expected.length >= 32 && a.length === b.length && timingSafeEqual(a, b)) return null;
  return NextResponse.json({ error: "Not allowed" }, { status: 401 });
}
