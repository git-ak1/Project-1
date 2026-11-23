// Reads the Supabase URL and publishable key from .env.local.
// Next.js loads .env.local automatically; NEXT_PUBLIC_ values are also
// baked into the browser bundle, which is safe for these two values.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing Supabase settings. Add NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local (see .env.example).",
  );
}

export const supabaseUrl: string = url;
export const supabasePublishableKey: string = publishableKey;
