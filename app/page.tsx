import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Home: signed-in guests go to their account, everyone else to sign in.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/account" : "/login");
}
