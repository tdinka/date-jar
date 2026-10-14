"use client";

import { useState, useTransition } from "react";
import { addIdea, clearNextDate, logDate, makeNextDate, removeIdea, setNextDateTime } from "@/app/actions";
import Chat from "./Chat";

export type IdeaView = {
  id: string;
  title: string;
  place: string;
  notes: string;
  cost: string;
  setting: string;
  needsBooking: boolean;
  source: string;
  addedBy: string | null;
  dates: string[]; // YYYY-MM-DD, oldest first
};
export type PlanView = { title: string; place: string; when: string | null; booking: string };
type HistoryView = { id: string; title: string; date: string };

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Tags({ idea }: { idea: Pick<IdeaView, "cost" | "setting" | "needsBooking" | "source"> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="tag">{idea.cost}</span>
      <span className="tag">{idea.setting === "home" ? "At home" : "Going out"}</span>
      {idea.needsBooking && <span className="tag">Needs booking</span>}
      {idea.source === "claude" && <span className="tag">Claude's idea</span>}
    </div>
  );
}

// Ideas not tried, or not done for a while, are more likely to come up.
function pickWeighted(pool: IdeaView[]) {
  const now = Date.now();
  const weights = pool.map((i) => {
    const last = i.dates[i.dates.length - 1];
    if (!last) return 3;
    const days = (now - new Date(last).getTime()) / 864e5;
    return Math.max(0.2, Math.min(3, days / 60));
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k];
    if (r <= 0) return pool[k];
  }
  return pool[0];
}

export default function Jar({ ideas, plan, history, email }: { ideas: IdeaView[]; plan: PlanView | null; history: HistoryView[]; email: string }) {
  const [pending, startTransition] = useTransition();
  const [costFilter, setCostFilter] = useState<string | null>(null);
  const [settingFilter, setSettingFilter] = useState<string | null>(null);
  const [picked, setPicked] = useState<IdeaView | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editingWhen, setEditingWhen] = useState(false);

  const run = (fn: () => Promise<void>, done?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (done) setMessage(done);
      } catch {
        setMessage("That didn't save. Check your connection and try again.");
      }
    });

  function surprise() {
    const pool = ideas.filter((i) => (!costFilter || i.cost === costFilter) && (!settingFilter || i.setting === settingFilter));
    setNoMatch(pool.length === 0);
    setPicked(pool.length ? pickWeighted(pool) : null);
  }

  const showPlan = plan && (!plan.when || new Date(plan.when).getTime() > Date.now() - 864e5);

  return (
    <main className="mx-auto grid max-w-xl gap-7 px-4 pb-16 pt-6" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Westchester · every other week</p>
          <h1 className="text-4xl font-bold tracking-tight">Our Date Jar</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="text-sm text-muted underline" title={email}>Sign out</button>
        </form>
      </header>

      {/* Next date */}
      <section className="grid gap-3 rounded-2xl bg-dusk p-5 text-on-dusk" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-on-dusk/70">Next date</p>
        {showPlan ? (
          <>
            <h2 className="text-2xl font-bold">{plan!.title}</h2>
            <p className="text-on-dusk/80">
              {[plan!.when ? fmtWhen(plan!.when) : "Time not set yet", plan!.place].filter(Boolean).join(" · ")}
              {plan!.booking && <span className="ml-2 rounded-full bg-amber px-2.5 py-0.5 text-sm font-semibold text-[#2A1B05]">{plan!.booking}</span>}
            </p>
            {editingWhen ? (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (e.currentTarget.elements.namedItem("when") as HTMLInputElement).value;
                  run(() => setNextDateTime(v ? new Date(v).toISOString() : null), "Time saved.");
                  setEditingWhen(false);
                }}
              >
                <label htmlFor="when" className="sr-only">Date and time</label>
                <input id="when" name="when" type="datetime-local" className="field max-w-[15rem] bg-card" required />
                <button className="btn btn-sm bg-on-dusk text-dusk">Save</button>
                <button type="button" className="btn btn-sm text-on-dusk underline" onClick={() => setEditingWhen(false)}>Cancel</button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm bg-on-dusk text-dusk" onClick={() => setEditingWhen(true)}>{plan!.when ? "Change time" : "Set a time"}</button>
                <button className="btn btn-sm text-on-dusk underline" onClick={() => run(clearNextDate)}>Clear</button>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Nothing planned yet</h2>
            <p className="text-on-dusk/80">Pull an idea from the jar, or wait for Claude's Sunday suggestions.</p>
          </>
        )}
      </section>

      <Chat />

      {/* Pull from the jar */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Pull from the jar</h2>
          {ideas.length > 0 && <span className="text-sm tabular-nums text-muted">{ideas.length} idea{ideas.length === 1 ? "" : "s"}</span>}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
          {["$", "$$", "$$$"].map((c) => (
            <FilterChip key={c} on={costFilter === c} onClick={() => setCostFilter(costFilter === c ? null : c)}>{c}</FilterChip>
          ))}
          <FilterChip on={settingFilter === "home"} onClick={() => setSettingFilter(settingFilter === "home" ? null : "home")}>At home</FilterChip>
          <FilterChip on={settingFilter === "out"} onClick={() => setSettingFilter(settingFilter === "out" ? null : "out")}>Going out</FilterChip>
        </div>
        <div>
          <button className="btn-primary px-6 py-3.5 text-lg" onClick={surprise}>Surprise us</button>
        </div>
        {noMatch && <p className="text-muted">Nothing in the jar matches those filters. Clear a filter or add an idea.</p>}
        {picked && (
          <div className="grid gap-3 rounded-2xl border-2 border-jacaranda bg-card p-4 motion-safe:animate-[pop_.35s_ease-out]">
            <p className="eyebrow">The jar says</p>
            <h3 className="text-2xl font-bold">{picked.title}</h3>
            {(picked.place || picked.notes) && <p className="text-muted">{[picked.place, picked.notes].filter(Boolean).join(" — ")}</p>}
            <Tags idea={picked} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" disabled={pending} onClick={() => run(() => makeNextDate(picked.id), "Saved as your next date.")}>
                Make this our next date
              </button>
              <button className="btn-ghost btn-sm" onClick={surprise}>Pull again</button>
            </div>
            {picked.needsBooking && <p className="text-sm text-muted">This one needs a booking. Ask Claude in the app to find a table; it will check with you before booking.</p>}
          </div>
        )}
      </section>

      <AddIdea onAdd={(data) => run(() => addIdea(data), "Added to the jar.")} pending={pending} />

      {/* In the jar */}
      <section className="grid gap-2">
        <h2 className="text-xl font-bold">In the jar</h2>
        <div className="border-t border-line">
          {ideas.length === 0 && <p className="py-4 text-muted">The jar is empty. Open “Add an idea” above and drop in the first one.</p>}
          {ideas.map((i) => (
            <div key={i.id} className="grid min-w-0 gap-1.5 border-b border-line py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{i.title}</span>
                <Tags idea={i} />
              </div>
              {(i.place || i.notes) && <p className="break-words text-sm text-muted">{[i.place, i.notes].filter(Boolean).join(" — ")}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  {i.dates.length ? `Done ${i.dates.length}× · last ${fmtDay(i.dates[i.dates.length - 1])}` : "Not tried yet"}
                  {i.addedBy && ` · added by ${i.addedBy}`}
                </span>
                <div className="flex gap-2">
                  <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(() => logDate(i.id, today()), `Logged “${i.title}”.`)}>We did this</button>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirmRemove !== i.id) return setConfirmRemove(i.id);
                      setConfirmRemove(null);
                      run(() => removeIdea(i.id));
                    }}
                  >
                    {confirmRemove === i.id ? "Tap again to remove" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Dates we've had</h2>
        <div className="border-t border-line">
          {history.length === 0 && <p className="py-4 text-muted">Your past dates will show up here once you mark one done.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex justify-between gap-3 border-b border-line py-3">
              <span className="font-semibold">{h.title}</span>
              <span className="text-sm tabular-nums text-muted">{fmtDay(h.date)}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted" role="status">{pending ? "Saving…" : message}</p>
    </main>
  );
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium ${on ? "bg-jacaranda text-on-jacaranda" : "bg-chip text-ink"}`}
    >
      {children}
    </button>
  );
}

function AddIdea({ onAdd, pending }: { onAdd: (d: { title: string; place: string; notes: string; cost: "$" | "$$" | "$$$"; setting: "home" | "out"; needsBooking: boolean }) => void; pending: boolean }) {
  return (
    <details className="group">
      <summary className="cursor-pointer font-semibold">Add an idea</summary>
      <form
        className="mt-3 grid gap-3 rounded-2xl border border-line bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const val = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value;
          onAdd({
            title: val("title"),
            place: val("place"),
            notes: val("notes"),
            cost: val("cost") as "$" | "$$" | "$$$",
            setting: val("setting") as "home" | "out",
            needsBooking: (f.elements.namedItem("needsBooking") as HTMLInputElement).checked,
          });
          f.reset();
        }}
      >
        <label className="label" htmlFor="f-title">Idea
          <input id="f-title" name="title" required maxLength={120} className="field" placeholder="Sunset walk at Dockweiler, then tacos" />
        </label>
        <label className="label" htmlFor="f-place">Place (optional)
          <input id="f-place" name="place" maxLength={120} className="field" placeholder="Name or neighbourhood" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label" htmlFor="f-cost">Cost
            <select id="f-cost" name="cost" defaultValue="$$" className="field"><option>$</option><option>$$</option><option>$$$</option></select>
          </label>
          <label className="label" htmlFor="f-setting">Where
            <select id="f-setting" name="setting" defaultValue="out" className="field"><option value="out">Going out</option><option value="home">At home</option></select>
          </label>
        </div>
        <label className="label" htmlFor="f-notes">Notes (optional)
          <textarea id="f-notes" name="notes" maxLength={400} className="field min-h-[4rem]" placeholder="Best on a weekday; ask for the patio" />
        </label>
        <label className="flex items-center gap-2 font-medium" htmlFor="f-book">
          <input id="f-book" name="needsBooking" type="checkbox" /> Needs a reservation or tickets
        </label>
        <div><button className="btn-primary" disabled={pending}>Add to jar</button></div>
      </form>
    </details>
  );
}
