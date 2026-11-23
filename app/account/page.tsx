import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Only signed-in guests can see this page (proxy.ts also guards it).
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="card">
      <h1>You&apos;re signed in</h1>
      <p className="muted">Signed in as {user.email}</p>
      <form action="/auth/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
