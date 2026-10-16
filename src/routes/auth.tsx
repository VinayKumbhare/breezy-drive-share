import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const next = oauthReturnPath(search["next"]);
    return next === "/" ? {} : { next };
  },
  head: () => ({
    meta: [
      { title: "Sign in — PaperLeak" },
      {
        name: "description",
        content: "Sign in or create your PaperLeak account to save papers and pick your branch.",
      },
      { property: "og:title", content: "Sign in — PaperLeak" },
      {
        property: "og:description",
        content: "Sign in or create your PaperLeak account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const BRANCHES = [
  "Computer Science and Engineering",
  "CSE (Data Science)",
  "CSE (AI & ML)",
  "Information Science",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical",
  "Civil",
  "Other",
];

function AuthPage() {
  const navigate = useNavigate();
  const { next = "/" } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: new URL(next, window.location.origin).href,
            data: { full_name: fullName, branch },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account, then sign in.");
          setMode("signin");
        } else {
          navigate({ to: next });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: next });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: new URL(next, window.location.origin).href,
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: next });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          SBJIT · Study material
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to access your papers and saved material."
            : "Sign up to save papers and get material for your branch."}
        </p>

        <button
          type="button"
          onClick={googleSignIn}
          disabled={busy}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold shadow-sm transition hover:border-accent hover:shadow disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1z"
            />
            <path
              fill="#EA4335"
              d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or with email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
              />
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
          />

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-border bg-secondary p-3 text-sm">{message}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-4 text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to browsing
          </a>
        </p>
      </main>
    </div>
  );
}
