import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ROOT_FOLDER_ID = "1dpTPs9OMHEtkrJBrYiJzic8ukzknxG5Y";

export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

async function driveFetch(path: string, params: Record<string, string>) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Drive connection is not configured for this project.");
  }
  const url = `${GATEWAY}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Drive request failed [${res.status}]: ${body}`);
    throw new Error(`Drive request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

function toItem(f: any): DriveItem {
  return {
    id: f.id,
    name: (f.name ?? "").trim(),
    mimeType: f.mimeType,
    isFolder: f.mimeType === "application/vnd.google-apps.folder",
    size: f.size,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
  };
}

export const listAllFiles = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ folderId: z.string().default(ROOT_FOLDER_ID) }).parse(data),
  )
  .handler(async ({ data }) => {
    const files: (DriveItem & { path: string })[] = [];
    const queue: { id: string; path: string }[] = [{ id: data.folderId, path: "" }];
    while (queue.length > 0 && files.length < 500) {
      const { id, path } = queue.shift()!;
      let pageToken: string | undefined;
      do {
        const params: Record<string, string> = {
          q: `'${id}' in parents and trashed=false`,
          fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink)",
          pageSize: "200",
          orderBy: "folder,name",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
        };
        if (pageToken) params["pageToken"] = pageToken;
        const json: any = await driveFetch("/files", params);
        for (const f of json.files ?? []) {
          const item = toItem(f);
          if (item.isFolder) queue.push({ id: item.id, path: path ? `${path} / ${item.name}` : item.name });
          else files.push({ ...item, path });
        }
        pageToken = json.nextPageToken;
      } while (pageToken);
    }
    return { folderId: data.folderId, files };
  });

export const listFolder = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ folderId: z.string().default(ROOT_FOLDER_ID) }).parse(data),
  )
  .handler(async ({ data }) => {
    const items: DriveItem[] = [];
    let pageToken: string | undefined;
    do {
      const params: Record<string, string> = {
        q: `'${data.folderId}' in parents and trashed=false`,
        fields:
          "nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink)",
        pageSize: "200",
        orderBy: "folder,name",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      };
      if (pageToken) params["pageToken"] = pageToken;
      const json: any = await driveFetch("/files", params);
      for (const f of json.files ?? []) items.push(toItem(f));
      pageToken = json.nextPageToken;
    } while (pageToken);

    let folderName = "All material";
    if (data.folderId !== ROOT_FOLDER_ID) {
      const meta: any = await driveFetch(`/files/${data.folderId}`, {
        fields: "id,name",
        supportsAllDrives: "true",
      });
      folderName = (meta.name ?? "").trim();
    }

    return { folderId: data.folderId, folderName, items };
  });
