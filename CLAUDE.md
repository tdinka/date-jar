# Date Jar — notes for Claude Code

A small private web app for Tsega and their wife: a shared jar of date ideas, "Surprise us" picks, the next planned date, and a history of dates. Two users only.

## About the owner
- Tsega is early in their technical journey. Explain every terminal command in plain words before running it, one step at a time, and say clearly when Tsega needs to do something themselves (GitHub Desktop, Railway, Resend).
- Git: Tsega commits and pushes through GitHub Desktop. Don't run `git commit`/`git push` unless asked; when a change is ready, summarize what to look for in the diff.

## Stack (matches Recipe Box, ~/Projects/recipe-app)
- Next.js 14 (App Router, TypeScript) + Tailwind CSS. Fonts: Bricolage Grotesque (headings), Figtree (text).
- Postgres on Railway via Prisma. Use `prisma db push`, NEVER `prisma migrate dev`.
- Sign-in: 6-digit email codes (own code, no NextAuth). Only emails in `ALLOWED_EMAILS` can sign in. Codes are stored hashed, expire in 10 minutes, 5 tries. Emails go through Resend; with no `RESEND_API_KEY` the code is printed in the dev terminal.
- Session: signed cookie (`jose`, `SESSION_SECRET`), checked in `src/middleware.ts`. New public routes must be excluded in the middleware matcher.
- Live at https://date-jar-production-ed3a.up.railway.app
- Hosting: Railway project "date-jar" (services: date-jar, Postgres). The date-jar service deploys automatically on every push to `main` (connected Oct 2026). `npm start` runs `prisma db push` first, so schema changes apply on deploy (the database has no public address). db push refuses data-losing changes; never add --accept-data-loss.

## Look
- Colours are CSS variables in `src/app/globals.css`, named in `tailwind.config.ts`: fog (background), dusk (Next date panel), jacaranda (actions only), amber (highlights, only behind dark text).

## Related
- Sunday "Date night check-in" (Claude app scheduled task) uses `/api/agent/*` (state, ideas, plan, checkin) with `Authorization: Bearer <AGENT_TOKEN>`. The token is on Railway and in `~/.config/date-jar/agent-token` (mode 600) on Tsega's Mac. Never print it.
- Earlier prototype (retired): claude.ai artifact "Our Date Jar".
- Chat ("Plan with Claude"): `src/app/api/chat/route.ts` runs a manual tool loop on claude-opus-5-5 (effort low, server-side fallbacks "default"); tools in `src/lib/chat-tools.ts` (add_idea, log_date, set_next_date). Needs `ANTHROPIC_API_KEY` on Railway. Chat history lives in each browser (localStorage).
- Google Calendar (busy/free only, scope calendar.freebusy): `src/lib/google.ts` (OAuth via fetch, refresh tokens AES-GCM encrypted with a key derived from SESSION_SECRET), `src/lib/free-slots.ts` (weeknights 6-10pm, weekends 11am-10pm LA, 2.5h minimum), connect/callback/disconnect under `/api/google/`. Needs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` on Railway. Google Cloud project lives on tsega.dinka@gmail.com.
- Bookings: Next date card has OpenTable/Resy search links (pre-filled), "Ask Claude to book" (BookingRequest table; the Sunday check-in works the queue via `/api/agent/state` + `/api/agent/bookings`), and "We booked it".

## Gotchas
- Back up `.env` before any file reorganizing.
- Double-check Railway env var names exactly.
- Next.js 14.2: `useSearchParams` + `Suspense` + `force-dynamic` in a Server Component can stack-overflow; read `window.location.search` instead.
