"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.replace("/account");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Email confirmation is off in Supabase: the guest is signed in already.
      router.replace("/account");
      router.refresh();
      return;
    }
    setMessage("Check your email and click the link to finish signing up.");
  }

  const isSignIn = mode === "sign-in";

  return (
    <main className="card">
      <h1>{isSignIn ? "Guest sign in" : "Create a guest account"}</h1>
      <p className="muted">
        {isSignIn
          ? "Sign in to get help with your stay."
          : "Sign up with your email to get help with your stay."}
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="ok" role="status">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Please wait…" : isSignIn ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="switch">
        {isSignIn ? "New here? " : "Already have an account? "}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(isSignIn ? "sign-up" : "sign-in");
            setError(null);
            setMessage(null);
          }}
        >
          {isSignIn ? "Create an account" : "Sign in"}
        </button>
      </p>
    </main>
  );
}
