CREATE TABLE public.starred_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size TEXT,
  web_view_link TEXT,
  folder_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_id)
);
GRANT SELECT, INSERT, DELETE ON public.starred_papers TO authenticated;
GRANT ALL ON public.starred_papers TO service_role;
ALTER TABLE public.starred_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own stars" ON public.starred_papers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own stars" ON public.starred_papers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own stars" ON public.starred_papers FOR DELETE TO authenticated USING (auth.uid() = user_id);