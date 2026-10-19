import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Our Date Jar" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-xl gap-5 px-4 py-10 leading-relaxed">
      <header className="grid gap-1">
        <p className="eyebrow">Our Date Jar</p>
        <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      </header>

      <p>
        Our Date Jar is a private app for one couple to keep a list of date ideas and plan dates. Only two invited email
        addresses can sign in. It isn't open to the public.
      </p>

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Google Calendar</h2>
        <p>
          If you connect Google Calendar, the app asks for one permission: to see when you're busy or free
          (Google's <code>calendar.freebusy</code> permission), plus your email address so it can show which account is
          connected. It never sees event names, descriptions, locations or guests, and it can't change your calendar.
        </p>
        <p>
          Busy and free times are read when you ask for free times, when the chat checks, and during the Sunday
          check-in. They are used to suggest date times and are not stored. The app stores only an encrypted
          connection key so it can keep checking without asking you to sign in again.
        </p>
        <p>
          You can disconnect at any time with “Disconnect” in the app, which deletes the stored key. You can also
          remove access from your Google Account at myaccount.google.com/permissions.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">What the app stores</h2>
        <p>
          Your email address, the date ideas you add, the dates you log, the next planned date and any booking
          requests. Chat messages are sent to Anthropic's Claude to answer them and are kept only in your own
          browser. Nothing is sold or shared with anyone else.
        </p>
      </section>

      <section className="grid gap-2">
        <h2 className="text-xl font-bold">Contact</h2>
        <p>Questions or deletion requests: tsega.dinka@gmail.com</p>
      </section>

      <p className="text-sm text-muted">Last updated October 2026.</p>
    </main>
  );
}
