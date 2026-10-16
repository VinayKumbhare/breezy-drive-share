import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStarredPapersTool from "./tools/list-starred-papers";
import browseDriveTool from "./tools/browse-drive";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "shared-drive-viewer",
  title: "Shared Drive Viewer",
  version: "0.1.0",
  instructions:
    "Tools for PaperLeak, a college study-material browser. Use `browse_drive` to explore department folders and question papers, and `list_starred_papers` to read the signed-in user's saved Exam Bag papers.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [browseDriveTool, listStarredPapersTool],
});
