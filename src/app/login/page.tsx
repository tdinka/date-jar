"use client";

import { useState } from "react";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  }

  async function askForCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/request-code", { email });
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/verify", { email, code });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-4 py-10">
      <header className="grid gap-1">
        <p className="eyebrow">Westchester · every other week</p>
        <h1 className="text-4xl font-bold tracking-tight">Our Date Jar</h1>
      </header>

      {step === "email" ? (
        <form onSubmit={askForCode} className="grid gap-3 rounded-2xl border border-line bg-card p-5">
          <label className="label" htmlFor="email">
            Your email
            <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
        </form>
      ) : (
        <form onSubmit={checkCode} className="grid gap-3 rounded-2xl border border-line bg-card p-5">
          <p className="text-sm text-muted">
            If <span className="font-semibold text-ink">{email}</span> can use the jar, a 6-digit code is on its way. It works for 10 minutes.
          </p>
          <label className="label" htmlFor="code">
            Code
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className="field text-center text-2xl tracking-[0.4em] tabular-nums"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button className="btn-primary" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="text-sm text-muted underline" onClick={() => { setStep("email"); setCode(""); setError(""); }}>
            Use a different email or get a new code
          </button>
        </form>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-ink">{error}</p>}
    </main>
  );
}
