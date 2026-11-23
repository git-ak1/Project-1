import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The sign-up confirmation email links here with a one-time ?code=.
// We swap that code for a session cookie, then send the guest to their account.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
