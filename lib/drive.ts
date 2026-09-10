import { google } from "googleapis";
import type { Readable } from "node:stream";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  viewUrl: string;
};

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Manjkata GOOGLE_SERVICE_ACCOUNT_EMAIL ali GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }
  // Vercel env vars ne ohranijo dejanskih prelomov vrstic - shranjeni so kot "\n".
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

const MEDIA_MIME_PREFIXES = ["image/", "video/"];

/**
 * Vse fotografije/videe iz konfigurirane Drive mape (ne podmap).
 */
export async function listFolderMedia(): Promise<DriveFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("Manjka GOOGLE_DRIVE_FOLDER_ID");
  }
  const drive = getDrive();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, webViewLink)",
      pageSize: 200,
      pageToken,
    });
    for (const file of response.data.files ?? []) {
      if (
        !file.id ||
        !file.name ||
        !file.mimeType ||
        !MEDIA_MIME_PREFIXES.some((prefix) => file.mimeType!.startsWith(prefix))
      ) {
        continue;
      }
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        viewUrl: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
      });
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function getFileStream(fileId: string): Promise<Readable> {
  const drive = getDrive();
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return response.data as Readable;
}

export async function getFileBuffer(fileId: string): Promise<Buffer> {
  const stream = await getFileStream(fileId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
