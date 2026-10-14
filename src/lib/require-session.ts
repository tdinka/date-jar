import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionToken } from "./session";

// For server components and server actions. Sends signed-out visitors to /login.
export async function requireSession() {
  const session = await readSessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return session;
}
