# Project-1
Airbnb Help Chat Refund Safety. Guarded guest support chat with Supabase sign-in, server-side refund checks and prompt injection screening

## Guest sign-in (Next.js + TypeScript + Supabase)

1. Install Node.js (LTS), then run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.
3. Run `npm run dev` and open http://localhost:3000.

Guests can create an account and sign in with email and password. `/account` is only visible when signed in.
