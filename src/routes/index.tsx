import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, Folder, Linkedin, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { listFolder, listAllFiles, ROOT_FOLDER_ID, type DriveItem } from "@/lib/drive.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PaperLeak — Question Papers, Notes & Syllabus" },
      { name: "description", content: "Browse SBJIT question papers, syllabus, notes and e-books by department." },
      { property: "og:title", content: "PaperLeak — Question Papers & Notes" },
      { property: "og:description", content: "Browse SBJIT question papers, syllabus, notes and e-books by department." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Crumb = { id: string; name: string };

const folderTones = ["bg-secondary", "bg-accent", "bg-[var(--chrome-mint)]", "bg-[var(--chrome-lilac)]"];

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
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bCae\b/, "CAE").replace(/\bEse\b/, "ESE").replace(/\bQp\b/, "QP");
}

function Index() {
  const [path, setPath] = useState<Crumb[]>([{ id: ROOT_FOLDER_ID, name: "All material" }]);
  const [allOf, setAllOf] = useState<Crumb | null>(null);
  const [search, setSearch] = useState("");
  const current = path.at(-1) ?? { id: ROOT_FOLDER_ID, name: "All material" };
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
    queryFn: () => allOf ? fetchAll({ data: { folderId: allOf.id } }) : Promise.resolve({ files: [] }),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(allOf),
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((item: DriveItem) => item.name.toLowerCase().includes(q)) : items;
  }, [items, search]);
  const folders = filtered.filter((item) => item.isFolder);
  const files = filtered.filter((item) => !item.isFolder);

  const open = (item: DriveItem) => {
    setSearch("");
    setAllOf(null);
    setPath((previous) => [...previous, { id: item.id, name: titleCase(item.name) }]);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-7 sm:py-10 lg:px-10">
        <header className="grid items-end gap-8 border-b-4 border-foreground pb-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <div className="animate-pop-in">
            <div className="mb-4 inline-flex rotate-[-2deg] items-center gap-2 border-2 border-foreground bg-accent px-3 py-1.5 font-display text-xs font-bold uppercase shadow-[3px_3px_0_var(--foreground)]">
              <Sparkles className="size-3.5" /> SBJIT study vault
            </div>
            <h1 className="font-display text-5xl font-bold uppercase leading-[0.88] sm:text-7xl lg:text-8xl">
              Paper<span className="text-primary underline decoration-[10px] underline-offset-4">Leak</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
              Question papers, syllabus and notes—sorted by department, ready when the exam panic hits.
            </p>
          </div>

          <div className="animate-pop-in lg:pb-1" style={{ animationDelay: "100ms" }}>
            <label htmlFor="paper-search" className="mb-2 block font-display text-xs font-bold uppercase">
              Find your material
            </label>
            <div className="relative">
              <input
                id="paper-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search this folder..."
                className="h-16 w-full rounded-lg border-4 border-foreground bg-card py-3 pl-5 pr-14 text-base font-semibold outline-none shadow-[7px_7px_0_var(--foreground)] transition focus:translate-x-1 focus:translate-y-1 focus:shadow-none focus:ring-4 focus:ring-ring/30"
              />
              <span className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md border-2 border-foreground bg-accent">
                <Search className="size-5" strokeWidth={3} />
              </span>
            </div>
          </div>
        </header>

        <nav aria-label="Folder path" className="mt-7 flex flex-wrap items-center gap-2 font-display text-xs font-bold uppercase">
          {path.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              <Button
                variant={index === path.length - 1 ? "default" : "outline"}
                size="sm"
                onClick={() => { setAllOf(null); setPath((previous) => previous.slice(0, index + 1)); }}
              >
                {crumb.name}
              </Button>
            </span>
          ))}
        </nav>

        {allOf ? (
          <section className="mt-10 animate-pop-in">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-foreground pb-4">
              <div>
                <p className="font-display text-xs font-bold uppercase text-primary">Everything inside</p>
                <h2 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">{allOf.name}</h2>
              </div>
              <Button variant="outline" onClick={() => setAllOf(null)}>Back to folders</Button>
            </div>
            {allQuery.isPending && <LoadingRows />}
            {allQuery.error && <ErrorBanner text="Couldn't load the papers. Please try again." />}
            {allQuery.data && <AllPapersList files={allQuery.data.files} search={search} />}
          </section>
        ) : (
          <BrowseContent folders={folders} files={files} search={search} isPending={isPending} error={error} open={open} setAllOf={setAllOf} />
        )}
      </main>

      <footer className="mt-12 border-t-4 border-foreground bg-foreground px-5 py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <div><p className="font-display text-sm font-bold uppercase">PaperLeaks by CSE-DS</p><p className="mt-1 text-sm text-primary-foreground/70">Created by <strong>Vinay</strong></p></div>
          <Button asChild variant="outline" className="border-primary-foreground bg-accent text-accent-foreground shadow-[4px_4px_0_var(--primary-foreground)]">
            <a href="https://www.linkedin.com/in/vinaykumbhare" target="_blank" rel="noreferrer"><Linkedin className="size-4" />Connect on LinkedIn</a>
          </Button>
        </div>
      </footer>
    </div>
  );
}

function BrowseContent({ folders, files, search, isPending, error, open, setAllOf }: {
  folders: DriveItem[]; files: DriveItem[]; search: string; isPending: boolean; error: Error | null;
  open: (item: DriveItem) => void; setAllOf: (crumb: Crumb) => void;
}) {
  if (isPending) return <LoadingRows />;
  if (error) return <ErrorBanner text="Couldn't load this folder. Please refresh and try again." />;
  return (
    <div className="mt-10 space-y-12">
      {folders.length > 0 && (
        <section>
          <SectionTitle count={folders.length}>Folders</SectionTitle>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder, index) => (
              <article key={folder.id} className={`animate-pop-in border-4 border-foreground p-5 shadow-[7px_7px_0_var(--foreground)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${folderTones[index % folderTones.length]}`} style={{ animationDelay: `${Math.min(index * 45, 300)}ms` }}>
                <button onClick={() => open(folder)} className="group w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40">
                  <span className="grid size-12 place-items-center rounded-md border-2 border-foreground bg-card"><Folder className="size-6" strokeWidth={2.5} /></span>
                  <h3 className="mt-5 font-display text-lg font-bold uppercase leading-tight sm:text-xl">{titleCase(folder.name)}</h3>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase">Open folder <span className="transition-transform group-hover:translate-x-1">→</span></span>
                </button>
                <Button className="mt-5 w-full" size="sm" onClick={() => { setAllOf({ id: folder.id, name: titleCase(folder.name) }); }}>List all papers</Button>
              </article>
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && <FileSection files={files} />}
      {folders.length === 0 && files.length === 0 && <p className="border-4 border-dashed border-foreground/30 p-8 text-center font-display text-sm font-bold uppercase text-muted-foreground">{search ? "Nothing matches your search here." : "This folder is empty."}</p>}
    </div>
  );
}

function SectionTitle({ count, children }: { count: number; children: string }) {
  return <h2 className="flex items-center gap-3 font-display text-sm font-bold uppercase"><span className="grid size-8 rotate-[-4deg] place-items-center border-2 border-foreground bg-primary text-primary-foreground shadow-[2px_2px_0_var(--foreground)]">{count}</span>{children}</h2>;
}

function LoadingRows() {
  return <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-40 animate-pulse border-4 border-foreground bg-muted" />)}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return <p className="mt-8 border-4 border-destructive bg-card p-5 font-display text-sm font-bold uppercase text-destructive shadow-[6px_6px_0_var(--destructive)]">{text}</p>;
}

function FileSection({ files }: { files: DriveItem[] }) {
  return <section><SectionTitle count={files.length}>Files</SectionTitle><FileList files={files} /></section>;
}

function FileList({ files }: { files: (DriveItem & { path?: string })[] }) {
  return (
    <ul className="mt-5 divide-y-2 divide-foreground overflow-hidden border-4 border-foreground bg-card shadow-[7px_7px_0_var(--foreground)]">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted sm:p-5">
          <span className="rounded-sm border-2 border-foreground bg-accent px-2 py-1 font-display text-[10px] font-bold">{fileIcon(file.mimeType)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{file.name}</span>{file.path && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{file.path}</span>}</span>
          {prettySize(file.size) && <span className="text-xs font-semibold text-muted-foreground">{prettySize(file.size)}</span>}
          <Button asChild variant="outline" size="sm"><a href={file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" />View</a></Button>
          <Button asChild size="sm"><a href={`https://drive.google.com/uc?export=download&id=${file.id}`}><Download className="size-3.5" />Download</a></Button>
        </li>
      ))}
    </ul>
  );
}

function AllPapersList({ files, search }: { files: (DriveItem & { path: string })[]; search: string }) {
  const query = search.trim().toLowerCase();
  const filtered = query ? files.filter((file) => file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)) : files;
  if (filtered.length === 0) return <p className="mt-6 font-display text-sm font-bold uppercase text-muted-foreground">{query ? "No papers match your search." : "No papers found here yet."}</p>;
  return <><p className="mt-5 font-display text-xs font-bold uppercase text-muted-foreground">{filtered.length} papers found</p><FileList files={filtered} /></>;
}
