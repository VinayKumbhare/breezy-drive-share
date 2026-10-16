import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_starred_papers",
  title: "List starred papers",
  description: "List the question papers and files the signed-in user has saved to their Exam Bag in PaperLeak.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("starred_papers")
      .select("file_id, name, mime_type, size, web_view_link, folder_path")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not load starred papers: ${error.message}`);
    const papers = (data ?? []).map((p) => ({
      fileId: p.file_id,
      name: p.name,
      mimeType: p.mime_type,
      size: p.size,
      webViewLink: p.web_view_link,
      folderPath: p.folder_path,
    }));
    return {
      content: [
        {
          type: "text",
          text: papers.length === 0
            ? "The Exam Bag is empty — no starred papers yet."
            : papers.map((p) => `- ${p.name} (${p.folderPath ?? "unknown folder"})`).join("\n"),
        },
      ],
      structuredContent: { papers },
    };
  },
});
