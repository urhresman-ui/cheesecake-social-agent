import { listFolderMedia, type DriveFile } from "@/lib/drive";
import { getUsedFileIds, type ContentType } from "@/lib/social/store";
import { pickBestImage } from "@/lib/social/rank";

export type SelectedContent = DriveFile & {
  kind: "IMAGE" | "VIDEO";
  /** Za IMAGE: sorodni (vizualno podobni) file ID-ji, ki naj se ob potrditvi označijo kot uporabljeni skupaj s tem. */
  siblingFileIds: string[];
};

/**
 * Izbere Drive datoteko, ki še ni bila uporabljena za dani tip (POST ali
 * STORY). Isti file je lahko uporabljen enkrat za POST in enkrat za STORY -
 * "used" se spremlja ločeno po tipu.
 *
 * Če je med neuporabljenimi na voljo več fotografij, jih Anthropic vision
 * klic (lib/social/rank.ts) najprej združi po vizualni podobnosti (npr.
 * burst posnetki iste torte) in izbere najboljšo v vsaki skupini - le ta
 * najboljša fotografija vstopi v končni izbor, ostale iz iste skupine se
 * kasneje (ob potrditvi) označijo kot uporabljene skupaj z njo, da se
 * skoraj enak posnetek ne predlaga znova kot "nova" vsebina. Videi gredo
 * brez te obdelave (out of scope - le izbira med neuporabljenimi).
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

  const images = unused.filter((f) => !f.mimeType.startsWith("video/"));
  const videos = unused.filter((f) => f.mimeType.startsWith("video/"));

  let bestImage: (DriveFile & { siblingFileIds: string[] }) | null = null;
  if (images.length > 0) {
    const ranked = await pickBestImage(images);
    if (ranked) {
      const file = images.find((f) => f.id === ranked.chosenId);
      if (file) {
        bestImage = { ...file, siblingFileIds: ranked.groupFileIds };
      }
    }
  }

  const finalCandidates: Array<DriveFile & { kind: "IMAGE" | "VIDEO"; siblingFileIds: string[] }> = [
    ...(bestImage ? [{ ...bestImage, kind: "IMAGE" as const }] : []),
    ...videos.map((v) => ({ ...v, kind: "VIDEO" as const, siblingFileIds: [] })),
  ];
  if (finalCandidates.length === 0) return null;

  return finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
}
