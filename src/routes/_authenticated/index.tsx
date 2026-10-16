import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { listFolder, ROOT_FOLDER_ID, type DriveItem } from "@/lib/drive.functions";
import { useStars, useToggleStar } from "@/lib/stars";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "PaperLeak — Question Papers, Notes & Syllabus" },
      {
        name: "description",
        content:
          "Browse question papers, syllabus, notes and e-books by department, straight from the college Drive.",
      },
      { property: "og:title", content: "PaperLeak — Question Papers & Notes" },
      {
        property: "og:description",
        content:
          "Browse question papers, syllabus, notes and e-books by department.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Crumb = { id: string; name: string };

function fileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("image")) return "IMG";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "XLS";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "PPT";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  return "FILE";
}

function prettySize(size?: string) {
  if (!size) return null;
  const n = Number(size);
  if (!Number.isFinite(n)) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function titleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bCae\b/, "CAE")
    .replace(/\bEse\b/, "ESE")
    .replace(/\bQp\b/, "QP");
}

function AuthButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!user) return null;

  const name =
    (user.user_metadata?.["full_name"] as string | undefined) ?? user.email ?? "Account";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs font-medium text-muted-foreground sm:inline">
        {name}
      </span>
      <button
        onClick={signOut}
        className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition hover:border-accent"
      >
        Sign out
      </button>
    </div>
  );
}

function StarButton({ starred, onClick, busy }: { starred: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label={starred ? "Remove from Exam Bag" : "Add to Exam Bag"}
      title={starred ? "Remove from Exam Bag" : "Add to Exam Bag"}
      className={`grid size-8 place-items-center rounded-full border transition disabled:opacity-50 ${
        starred ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:border-accent hover:text-foreground"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinejoin="round" d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
      </svg>
    </button>
  );
}

function Index() {
  const [path, setPath] = useState<Crumb[]>([{ id: ROOT_FOLDER_ID, name: "All material" }]);
  const [search, setSearch] = useState("");
  const [showBag, setShowBag] = useState(false);
  const current = path[path.length - 1]!;
  const fetchFolder = useServerFn(listFolder);
  const stars = useStars();
  const toggle = useToggleStar();
  const starredIds = useMemo(() => new Set((stars.data ?? []).map((s) => s.file_id)), [stars.data]);
  const folderPath = path.slice(1).map((c) => c.name).join(" / ");

  const { data, isPending, error } = useQuery({
    queryKey: ["drive", current.id],
    queryFn: () => fetchFolder({ data: { folderId: current.id } }),
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i: DriveItem) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const folders = filtered.filter((i) => i.isFolder);
  const files = filtered.filter((i) => !i.isFolder);

  const open = (item: DriveItem) => {
    setSearch("");
    setShowBag(false);
    setPath((p) => [...p, { id: item.id, name: titleCase(item.name) }]);
  };

  const bag = stars.data ?? [];

  useWebMCP({
    name: "list_current_folder",
    description: "List the folders and files currently shown on screen in PaperLeak, respecting the active search filter.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () =>
      runWebMCPTool("list_current_folder", () => {
        if (isPending) return "Still loading this folder — try again in a moment.";
        if (filtered.length === 0) return "Nothing is shown in this folder.";
        return filtered
          .map((i) => `${i.id}: [${i.isFolder ? "folder" : "file"}] ${i.name}`)
          .join("\n");
      }),
  });

  useWebMCP({
    name: "open_folder",
    description: "Open one of the folders currently shown on screen, by its exact name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact name of a folder currently shown." },
      },
      required: ["name"],
    },
    execute: ({ name }: { name: string }) =>
      runWebMCPTool("open_folder", () => {
        const matches = folders.filter(
          (f) => f.name.toLowerCase() === String(name).trim().toLowerCase(),
        );
        if (matches.length === 0) throw new Error("No folder with that name is currently shown.");
        if (matches.length > 1) throw new Error("More than one shown folder has that name.");
        open(matches[0]!);
        return `Opened folder "${matches[0]!.name}".`;
      }),
  });

  useWebMCP({
    name: "star_paper",
    description: "Add or remove a currently shown file in the user's Exam Bag (starred papers).",
    enabled: !toggle.isPending,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact name of a file currently shown." },
        star: { type: "boolean", description: "true to add to the Exam Bag, false to remove." },
      },
      required: ["name", "star"],
    },
    execute: async ({ name, star }: { name: string; star: boolean }) =>
      runWebMCPTool("star_paper", async () => {
        const matches = files.filter(
          (f) => f.name.toLowerCase() === String(name).trim().toLowerCase(),
        );
        if (matches.length === 0) throw new Error("No file with that name is currently shown.");
        if (matches.length > 1) throw new Error("More than one shown file has that name.");
        const file = matches[0]!;
        const starred = starredIds.has(file.id);
        if (star === starred) {
          return star ? `"${file.name}" is already in the Exam Bag.` : `"${file.name}" is not in the Exam Bag.`;
        }
        await toggle.mutateAsync({ item: file, starred, folderPath });
        return star ? `Added "${file.name}" to the Exam Bag.` : `Removed "${file.name}" from the Exam Bag.`;
      }),
  });

  useWebMCP({
    name: "toggle_exam_bag",
    description: "Show or hide the My Exam Bag panel listing the user's starred papers.",
    inputSchema: {
      type: "object",
      properties: {
        show: { type: "boolean", description: "true to show the Exam Bag, false to return to browsing." },
      },
      required: ["show"],
    },
    execute: ({ show }: { show: boolean }) =>
      runWebMCPTool("toggle_exam_bag", () => {
        setShowBag(Boolean(show));
        return show ? "Exam Bag is now shown." : "Back to browsing.";
      }),
  });

  return (
    <div className="flex min-h-screen flex-col">
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          SBJIT · Study material
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBag((v) => !v)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              showBag ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card hover:border-accent"
            }`}
          >
            ★ My Exam Bag ({bag.length})
          </button>
          <AuthButton />
        </div>
      </div>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">PaperLeak</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every question paper, syllabus and note from the college Drive, organised by department.
        Pick a folder to go deeper.
      </p>

      {showBag ? (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide">My Exam Bag</h2>
            <button onClick={() => setShowBag(false)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Back to browsing
            </button>
          </div>
          {bag.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Your bag is empty. Tap the star next to any paper to save it here — it follows you on every device.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {bag.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <StarButton
                    starred
                    busy={toggle.isPending}
                    onClick={() => toggle.mutate({ item: { id: s.file_id, name: s.name, mimeType: s.mime_type }, starred: true })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {s.folder_path && <p className="truncate text-xs text-muted-foreground">{s.folder_path}</p>}
                  </div>
                  <a href={s.web_view_link ?? `https://drive.google.com/file/d/${s.file_id}/view`} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-accent">View</a>
                  <a href={`https://drive.google.com/uc?export=download&id=${s.file_id}`} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90">Download</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (<>
      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        {path.map((c, i) => (
          <span key={c.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <button
              onClick={() => setPath((p) => p.slice(0, i + 1))}
              className={
                i === path.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search in this folder…"
        className="mt-6 w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/40"
      />

      {isPending && (
        <div className="mt-10 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load this folder. Please refresh and try again.
        </p>
      )}

      {!isPending && !error && (
        <div className="mt-10 space-y-10">
          {folders.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] text-accent-foreground">
                  {folders.length}
                </span>
                Folders
              </h2>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => open(f)}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:border-accent hover:shadow"
                  >
                    {titleCase(f.name)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] text-accent-foreground">
                  {files.length}
                </span>
                Files
              </h2>
              <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {files.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-secondary"
                  >
                    <StarButton
                      starred={starredIds.has(f.id)}
                      busy={toggle.isPending}
                      onClick={() => toggle.mutate({ item: f, starred: starredIds.has(f.id), folderPath })}
                    />
                    <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
                      {fileIcon(f.mimeType)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                    {prettySize(f.size) && (
                      <span className="text-xs text-muted-foreground">{prettySize(f.size)}</span>
                    )}
                    <a
                      href={f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-accent"
                    >
                      View
                    </a>
                    <a
                      href={`https://drive.google.com/uc?export=download&id=${f.id}`}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {folders.length === 0 && files.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {search ? "Nothing matches your search here." : "This folder is empty."}
            </p>
          )}
        </div>
      )}
      </>)}
    </main>
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <p>PaperLeaks by CSE-DS</p>
      <p className="mt-1">
        Created by{" "}
        <span className="font-semibold text-foreground">Vinay</span>
      </p>
      <a
        href="https://www.linkedin.com/in/vinaykumbhare"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold transition hover:border-accent hover:shadow-sm"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
        Connect on LinkedIn
      </a>
    </footer>
    </div>
  );
}
