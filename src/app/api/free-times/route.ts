import { NextResponse } from "next/server";
import { CalendarError } from "@/lib/google";
import { freeSlots } from "@/lib/free-slots";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireSession();
  try {
    return NextResponse.json({ slots: await freeSlots() });
  } catch (e) {
    if (e instanceof CalendarError) return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    throw e;
  }
}
