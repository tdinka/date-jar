// Signed login cookie. Works in middleware (edge) and on the server.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dj_session";
export const SESSION_DAYS = 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; email: string };

export async function createSessionToken(session: Session) {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
