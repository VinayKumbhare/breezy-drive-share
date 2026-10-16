import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { listFolder, ROOT_FOLDER_ID } from "@/lib/drive.functions";

export default defineTool({
  name: "browse_drive",
  title: "Browse drive folder",
  description:
    "List the folders and files inside a PaperLeak Google Drive folder. Omit folderId to list the top-level department folders.",
  inputSchema: {
    folderId: z
      .string()
      .optional()
      .describe("Google Drive folder ID to list. Omit for the root folder with all departments."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ folderId }) => {
    const items = await listFolder(folderId ?? ROOT_FOLDER_ID);
    const entries = items.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
      mimeType: item.mimeType,
      size: item.size ?? null,
      webViewLink: item.webViewLink ?? null,
    }));
    return {
      content: [
        {
          type: "text",
          text: entries.length === 0
            ? "This folder is empty."
            : entries.map((e) => `- [${e.kind}] ${e.name} (id: ${e.id})`).join("\n"),
        },
      ],
      structuredContent: { items: entries },
    };
  },
});
