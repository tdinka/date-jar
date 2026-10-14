# Our Date Jar

A private shared jar of date ideas for two.

## Run it on your computer
1. `npm install`
2. Copy `.env.example` to `.env` and fill it in.
3. `npm run db:push` (creates the tables)
4. `npm run dev`, then open http://localhost:3000

## Deploy
Railway: a web service from this GitHub repo plus a Postgres database. Set `DATABASE_URL`, `SESSION_SECRET`, `ALLOWED_EMAILS`, `RESEND_API_KEY` and `EMAIL_FROM` on the web service.
