import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "node:crypto";

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

const GOOGLE_API = "https://www.googleapis.com/drive/v3";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

// ---------- Service Account OAuth2 (primary path for Vercel) ----------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getServiceAccountToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const clientEmail = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const privateKeyRaw = process.env["GOOGLE_PRIVATE_KEY"];
  if (!clientEmail || !privateKeyRaw) {
    throw new Error(
      "Google Drive is not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY (Vercel) or rely on the Lovable connector gateway.",
    );
  }

  // Private keys pasted into env vars often contain literal "\n" escapes.
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claims)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey)
    .toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Service account token request failed [${res.status}]: ${body}`);
    throw new Error(`Service account token request failed [${res.status}]: ${body}`);
  }

  const json: any = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

// ---------- Drive fetch ----------

async function driveFetch(path: string, params: Record<string, string>) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_DRIVE_API_KEY"];

  let url: string;
  let headers: Record<string, string> = {};

  const useServiceAccount =
    !!process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] && !!process.env["GOOGLE_PRIVATE_KEY"];

  if (useServiceAccount) {
    // Primary: Google Drive API with a service account (works on Vercel).
    const token = await getServiceAccountToken();
    url = `${GOOGLE_API}${path}?${new URLSearchParams(params).toString()}`;
    headers = { Authorization: `Bearer ${token}` };
  } else if (lovableKey && connKey) {
    // Fallback: Lovable connector gateway (used inside Lovable hosting).
    url = `${GATEWAY}${path}?${new URLSearchParams(params).toString()}`;
    headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    };
  } else {
    throw new Error(
      "Google Drive is not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.",
    );
  }

  const res = await fetch(url, { headers });
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
