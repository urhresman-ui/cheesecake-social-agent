import { listFolderMedia, type DriveFile } from "@/lib/drive";
import { getUsedFileIds, type ContentType } from "@/lib/social/store";

export type SelectedContent = DriveFile & { kind: "IMAGE" | "VIDEO" };

/**
 * Naključno izbere Drive datoteko, ki še ni bila uporabljena za dani tip
 * (POST ali STORY). Isti file je lahko uporabljen enkrat za POST in enkrat
 * za STORY - "used" se spremlja ločeno po tipu.
 */
export async function selectUnusedContent(
  type: ContentType
): Promise<SelectedContent | null> {
  const [files, used] = await Promise.all([
    listFolderMedia(),
    getUsedFileIds(type),
  ]);
  const unused = files.filter((file) => !used.has(file.id));
  if (unused.length === 0) return null;

  const pick = unused[Math.floor(Math.random() * unused.length)];
  return {
    ...pick,
    kind: pick.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE",
  };
}
