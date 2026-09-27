import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listFolder, listAllFiles, ROOT_FOLDER_ID, type DriveItem } from "@/lib/drive.functions";

export const Route = createFileRoute("/")({
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

function Index() {
  const [path, setPath] = useState<Crumb[]>([{ id: ROOT_FOLDER_ID, name: "All material" }]);
  const [allOf, setAllOf] = useState<Crumb | null>(null);
  const [search, setSearch] = useState("");
  const current = path[path.length - 1]!;
  const fetchFolder = useServerFn(listFolder);
  const fetchAll = useServerFn(listAllFiles);

  const { data, isPending, error } = useQuery({
    queryKey: ["drive", current.id],
    queryFn: () => fetchFolder({ data: { folderId: current.id } }),
    staleTime: 5 * 60 * 1000,
    enabled: !allOf,
  });

  const allQuery = useQuery({
    queryKey: ["drive-all", allOf?.id],
    queryFn: () => fetchAll({ data: { folderId: allOf!.id } }),
    staleTime: 5 * 60 * 1000,
    enabled: !!allOf,
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
    setAllOf(null);
    setPath((p) => [...p, { id: item.id, name: titleCase(item.name) }]);
  };

  return (
    <div className="flex min-h-screen flex-col">
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        SBJIT · Study material
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">PaperLeak</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every question paper, syllabus and note from the college Drive, organised by department.
        Pick a folder to go deeper, or hit "All papers" on a department to see everything in it.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        {path.map((c, i) => (
          <span key={c.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            <button
              onClick={() => {
                setAllOf(null);
                setPath((p) => p.slice(0, i + 1));
              }}
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

      {allOf && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide">
              All papers · {allOf.name}
            </h2>
            <button
              onClick={() => setAllOf(null)}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold transition hover:border-accent"
            >
              Back to browsing
            </button>
          </div>
          {allQuery.isPending && (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {allQuery.error && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Couldn't load the papers. Please try again.
            </p>
          )}
          {allQuery.data && (
            <AllPapersList files={allQuery.data.files} search={search} />
          )}
        </section>
      )}

      {!allOf && isPending && (
        <div className="mt-10 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!allOf && error && (
        <p className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load this folder. Please refresh and try again.
        </p>
      )}

      {!allOf && !isPending && !error && (
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
                  <span key={f.id} className="flex items-center gap-1.5">
                    <button
                      onClick={() => open(f)}
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:border-accent hover:shadow"
                    >
                      {titleCase(f.name)}
                    </button>
                    <button
                      onClick={() => {
                        setSearch("");
                        setAllOf({ id: f.id, name: titleCase(f.name) });
                      }}
                      title={`List all papers in ${titleCase(f.name)}`}
                      className="rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      All papers
                    </button>
                  </span>
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
    </main>
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <p>PaperLeaks by CSE-DS</p>
      <p className="mt-1">
        Created by{" "}
        <span className="font-semibold text-foreground">Vinay</span>
      </p>
    </footer>
    </div>
  );
}

function AllPapersList({ files, search }: { files: (DriveItem & { path: string })[]; search: string }) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    : files;
  if (filtered.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        {q ? "No papers match your search." : "No papers found here yet."}
      </p>
    );
  }
  return (
    <>
      <p className="mt-2 text-xs text-muted-foreground">{filtered.length} papers</p>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {filtered.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-secondary">
            <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold tracking-wide text-muted-foreground">
              {fileIcon(f.mimeType)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{f.name}</span>
              {f.path && <span className="block truncate text-xs text-muted-foreground">{f.path}</span>}
            </span>
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
    </>
  );
}
