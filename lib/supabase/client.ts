import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

// Supabase client for code that runs in the guest's browser.
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
