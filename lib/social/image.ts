import sharp from "sharp";
import type { ContentType } from "@/lib/social/store";

const DIMENSIONS: Record<ContentType, { width: number; height: number }> = {
  POST: { width: 1080, height: 1350 }, // 4:5
  STORY: { width: 1080, height: 1920 }, // 9:16
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildTextOverlaySvg(params: {
  width: number;
  height: number;
  text: string;
}): Buffer {
  const { width, height, text } = params;
  const fontSize = Math.round(width * 0.06);
  const lineHeight = Math.round(fontSize * 1.3);
  const lines = wrapText(text, 22).slice(0, 3);
  const bandHeight = lineHeight * lines.length + fontSize * 1.4;
  const bandY = height - bandHeight;

  const tspans = lines
    .map((line, index) => {
      const y = bandY + fontSize * 1.2 + index * lineHeight;
      return `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" fill="#fff5d9" font-weight="600">${escapeXml(line)}</text>`;
    })
    .join("\n");

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3a2a17" stop-opacity="0" />
          <stop offset="1" stop-color="#3a2a17" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <rect x="0" y="${bandY - fontSize}" width="${width}" height="${height - (bandY - fontSize)}" fill="url(#band)" />
      ${tspans}
    </svg>
  `);
}

/**
 * Obreže/prilagodi fotografijo na ciljno razmerje za dani tip objave, doda
 * rahel znamkin barvni preset in po želji vžge kratko besedilo na dno
 * slike. Vrne JPEG buffer.
 */
export async function renderEditedImage(
  input: Buffer,
  params: { type: ContentType; text?: string }
): Promise<Buffer> {
  const { width, height } = DIMENSIONS[params.type];

  let pipeline = sharp(input)
    .rotate() // upošteva EXIF orientacijo
    .resize(width, height, { fit: "cover", position: "attention" })
    .modulate({ brightness: 1.03, saturation: 1.08 })
    .linear(1.04, -6); // rahel kontrast

  if (params.text && params.text.trim()) {
    const overlay = buildTextOverlaySvg({ width, height, text: params.text });
    pipeline = pipeline.composite([{ input: overlay, top: 0, left: 0 }]);
  }

  return pipeline.jpeg({ quality: 88 }).toBuffer();
}
