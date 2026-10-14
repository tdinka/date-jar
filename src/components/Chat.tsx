"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Turn = { role: "user" | "assistant"; content: string };
type Line = Turn | { role: "action"; content: string };

const STORE_KEY = "datejar.chat.v1";
const STARTERS = [
  ["Cheap weeknight", "Pick something cozy and cheap for a weeknight."],
  ["New ideas", "Suggest a few new ideas near us that we haven't tried."],
  ["Weekend plan", "Plan something special for this weekend."],
];

export default function Chat() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      if (Array.isArray(saved)) setLines(saved.slice(-40));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(lines.slice(-40)));
    } catch {}
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  async function send(message: string) {
    message = message.trim();
    if (!message || busy) return;
    const next: Line[] = [...lines, { role: "user", content: message }];
    setLines(next);
    setText("");
    setBusy(true);
    // Only real turns go to Claude; the last 20 keep requests small.
    const turns = next.filter((l): l is Turn => l.role !== "action").slice(-20);
    while (turns.length && turns[0].role !== "user") turns.shift();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: turns,
          now: new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }),
          timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const actions: Line[] = (data.actions || []).map((a: string) => ({ role: "action", content: a }));
      setLines((l) => [...l, ...actions, { role: "assistant", content: data.reply || data.error || "That didn't go through. Try again." }]);
      if (actions.length) router.refresh();
    } catch {
      setLines((l) => [...l, { role: "assistant", content: "That didn't go through. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-card p-4" aria-label="Plan with Claude">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Plan with Claude</h2>
        {lines.length > 0 && (
          <button className="text-sm text-muted underline" onClick={() => setLines([])}>New chat</button>
        )}
      </div>

      <div ref={logRef} className="grid max-h-[26rem] gap-2.5 overflow-y-auto" aria-live="polite">
        <Bubble role="assistant">Tell me about a place you want to try and I'll add it to the jar, or ask for something like “a cheap night in this week.”</Bubble>
        {lines.map((l, k) => (
          <Bubble key={k} role={l.role}>{l.content}</Bubble>
        ))}
        {busy && <Bubble role="assistant">Thinking…</Bubble>}
      </div>

      {lines.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map(([label, say]) => (
            <button key={label} className="rounded-full bg-chip px-3 py-1 text-sm font-medium text-ink" onClick={() => send(say)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          id="chat-input"
          aria-label="Message"
          rows={1}
          maxLength={2000}
          className="field max-h-36 min-h-[2.75rem] min-w-0 flex-1 resize-y"
          placeholder="Add an idea or ask for a plan…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button className="btn-primary" disabled={busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}

function Bubble({ role, children }: { role: Line["role"]; children: React.ReactNode }) {
  if (role === "action") return <p className="px-1 text-sm text-muted">✓ {children}</p>;
  const mine = role === "user";
  return (
    <div
      className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 leading-snug ${
        mine ? "justify-self-end rounded-br-md bg-jacaranda text-on-jacaranda" : "justify-self-start rounded-bl-md bg-chip text-ink"
      }`}
    >
      {children}
    </div>
  );
}
