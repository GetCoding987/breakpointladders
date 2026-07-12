**Break Point Ladders**

A tennis ladder management app: challenges, match scores, rankings, messaging, and season memberships (paid via Stripe).

**Stack**

- Frontend: Vite + React, deployed on Vercel
- Backend: [Supabase](https://supabase.com) — Postgres, Auth, Realtime, Storage
- Serverless functions (`api/`): Stripe checkout/webhook, promo codes, notification emails (Resend), cron reminders — deployed as Vercel Functions

**Local setup**

1. Clone the repo and install dependencies: `npm install`
2. Create a `.env.local` file with:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

3. Run the app: `npm run dev`

**Serverless functions**

The `api/` functions need these environment variables (set in Vercel project settings, not `.env.local`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PROMO_CODES`, `ALLOWED_CHECKOUT_ORIGINS`
- `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `APP_BASE_URL`
- `CRON_SECRET`

**Database schema**

Schema and RLS policies live in `supabase/migrations/`. Apply them via the Supabase CLI or dashboard SQL editor.
