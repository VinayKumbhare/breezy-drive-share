import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { oauth } from "@/lib/oauth";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({
    meta: [
      { title: "Connect an app — PaperLeak" },
      { name: "description", content: "Authorize an external app to use PaperLeak as you." },
      { property: "og:title", content: "Connect an app — PaperLeak" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "The authorization request could not be loaded."}
        </p>
      </div>
    </div>
  ),
});

type Details = {
  clientName: string;
  redirectUri: string | null;
  scopes: string[];
};

const SCOPE_LABELS: Record<string, string> = {
  openid: "Share your basic profile",
  email: "Share your email address",
  profile: "Share your basic profile",
};

function ConsentPage() {
  const navigate = useNavigate();
  const [details, setDetails] = useState<Details | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authorizationId =
    typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("authorization_id")
      : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authorizationId) {
        setError("This authorization link is missing its request ID. Please start again from the app you're connecting.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const next = oauthReturnPath(`/.lovable/oauth/consent?authorization_id=${authorizationId}`);
        navigate({ to: "/auth", search: { next }, replace: true });
        return;
      }
      setUserEmail(sessionData.session.user.email ?? null);
      const { data, error: detailsError } = await oauth.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (detailsError) {
        setError("This authorization request is invalid or has expired. Please start again from the app you're connecting.");
        return;
      }
      const redirect = data?.redirect_url ?? data?.redirect_to;
      if (redirect && !data?.client) {
        window.location.href = redirect;
        return;
      }
      setDetails({
        clientName: data?.client?.name ?? "An external app",
        redirectUri: data?.client?.redirect_uris?.[0] ?? null,
        scopes: (data?.scope ?? "").split(" ").filter(Boolean),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizationId, navigate]);

  const decide = async (approve: boolean) => {
    if (!authorizationId) return;
    setBusy(true);
    setError(null);
    const { data, error: decideError } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (decideError) {
      setError(approve ? "Approval failed. Please try again." : "Cancellation failed. Please try again.");
      setBusy(false);
      return;
    }
    const redirect = data?.redirect_url ?? data?.redirect_to;
    if (redirect) window.location.href = redirect;
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <main className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          PaperLeak
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Connect {details?.clientName ?? "…"} to PaperLeak
        </h1>

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!details && !error && (
          <p className="mt-4 text-sm text-muted-foreground">Loading authorization request…</p>
        )}

        {details && (
          <>
            {userEmail && (
              <p className="mt-2 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{userEmail}</span>
              </p>
            )}
            <p className="mt-4 text-sm">
              This lets <span className="font-semibold">{details.clientName}</span> use this app as
              you — it will be able to call PaperLeak's enabled tools while you are signed in.
            </p>
            {details.redirectUri && (
              <p className="mt-2 break-all text-xs text-muted-foreground">
                Returns to: {details.redirectUri}
              </p>
            )}
            <ul className="mt-4 space-y-1.5 text-sm">
              {details.scopes.map((scope) => (
                <li key={scope} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-accent" />
                  {SCOPE_LABELS[scope] ?? `Additional permission requested: ${scope}`}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              This does not bypass this app's permissions or backend policies.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => decide(true)}
                disabled={busy}
                className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Please wait…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => decide(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-accent disabled:opacity-60"
              >
                Cancel connection
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
