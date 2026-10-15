import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DriveItem } from "@/lib/drive.functions";

export type StarredPaper = {
  id: string;
  file_id: string;
  name: string;
  mime_type: string;
  size: string | null;
  web_view_link: string | null;
  folder_path: string | null;
};

const KEY = ["starred-papers"];

export function useStars() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("starred_papers")
        .select("id, file_id, name, mime_type, size, web_view_link, folder_path")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StarredPaper[];
    },
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      item,
      starred,
      folderPath,
    }: {
      item: { id: string; name: string; mimeType: string; size?: string | null; webViewLink?: string | null };
      starred: boolean;
      folderPath?: string;
    }) => {
      if (starred) {
        const { error } = await supabase.from("starred_papers").delete().eq("file_id", item.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        const { error } = await supabase.from("starred_papers").insert({
          user_id: u.user.id,
          file_id: item.id,
          name: item.name,
          mime_type: item.mimeType,
          size: item.size ?? null,
          web_view_link: item.webViewLink ?? null,
          folder_path: folderPath ?? null,
        });
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type { DriveItem };
