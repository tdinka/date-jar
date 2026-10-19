"use client";

import { useEffect, useState } from "react";
import type { CalendarView } from "./Jar";

type Slot = { start: string; end: string; label: string; weekend: boolean };

const RETURN_MESSAGES: Record<string, string> = {
  connected: "Google Calendar connected. The app can now see when you're busy, never what's on your calendar.",
  cancelled: "Calendar connection cancelled.",
  error: "Couldn't connect Google Calendar. Try again.",
  disconnected: "Google Calendar disconnected.",
  "not-set-up": "Calendar connection isn't set up on the server yet.",
};

export default function FreeTimes({ calendar }: { calendar: CalendarView }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // After coming back from Google, show what happened, then tidy the address bar.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("calendar");
    if (status && RETURN_MESSAGES[status]) {
      setNote(RETURN_MESSAGES[status]);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  async function load() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/free-times");
      const data = await res.json();
      if (!res.ok) {
        setSlots(null);
        setNote(data.code === "reconnect" ? "Google Calendar needs reconnecting. Use “Reconnect” below." : data.error || "Couldn't read the calendar.");
      } else setSlots(data.slots);
    } catch {
      setNote("Couldn't read the calendar. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (!calendar.configured) return null;

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">When are we free?</h2>
        {calendar.anyConnected && (
          <button className="btn-ghost btn-sm" onClick={load} disabled={busy}>{busy ? "Checking…" : slots ? "Check again" : "Check the calendar"}</button>
        )}
      </div>

      {!calendar.anyConnected && (
        <p className="text-muted">Connect your Google Calendar and the app (and Claude) can find your free evenings. It only sees busy or free, never event names.</p>
      )}

      {slots && slots.length === 0 && <p className="text-muted">No free evenings or weekend afternoons in the next two weeks.</p>}
      {slots && slots.length > 0 && (
        <ul className="grid gap-1.5">
          {slots.slice(0, 8).map((s) => (
            <li key={s.start} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2">
              <span className="tabular-nums">{s.label}</span>
              <span className="tag">{s.weekend ? "Weekend" : "Evening"}</span>
            </li>
          ))}
        </ul>
      )}
      {slots && <p className="text-sm text-muted">From the connected calendar. Check with each other before you lock it in.</p>}

      {note && <p className="text-sm font-semibold" role="status">{note}</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {calendar.mine ? (
          <>
            <span className="text-muted">Connected: {calendar.mine}</span>
            <a className="text-muted underline" href="/api/google/connect">Reconnect</a>
            <form action="/api/google/disconnect" method="post">
              <button className="text-muted underline">Disconnect</button>
            </form>
          </>
        ) : calendar.anyConnected ? (
          <a className="text-muted underline" href="/api/google/connect">Add your calendar too</a>
        ) : (
          <a className="btn-primary btn-sm" href="/api/google/connect">Connect Google Calendar</a>
        )}
      </div>
    </section>
  );
}
