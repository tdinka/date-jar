import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

// Everything is private except the login and privacy pages, sign-in API, the check-in API (has its own token) and static files.
export async function middleware(req: NextRequest) {
  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!login|privacy|api/auth|api/agent|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
