import sharp from "sharp";
import { getFileBuffer } from "@/lib/drive";

/**
 * Prenese Drive fotografijo in jo pomanjša v majhen base64 JPEG, primeren
 * za pošiljanje v Anthropic vision klic (izbira najboljše med podobnimi,
 * priprava captiona ob dejanskem ogledu slike namesto ugibanja iz imena
 * datoteke).
 */
export async function makeThumbnailBase64(fileId: string, size = 320): Promise<string> {
  const original = await getFileBuffer(fileId);
  const thumb = await sharp(original)
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 65 })
    .toBuffer();
  return thumb.toString("base64");
}
