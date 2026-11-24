// Reads the OpenRouter API key for server code only.
//
// The variable has no NEXT_PUBLIC_ prefix, so Next.js never puts it in the
// browser bundle. This module also refuses to run in a browser, so importing
// it from a client component fails loudly instead of leaking the key.
//
// Per the refund policy, the model may only explain a decision to the guest.
// It never decides a refund or sets an amount (see lib/refunds/policy.ts).

if (typeof window !== "undefined") {
  throw new Error("lib/openrouter/env.ts is server-only and must not be imported in the browser.");
}

export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Add it to .env.local (see .env.example) and restart the server.",
    );
  }
  return key;
}
