import type { DriveFile } from "@/lib/drive";
import { extractJson } from "@/lib/social/json";
import { extractAnthropicText } from "@/lib/social/anthropic";
import { makeThumbnailBase64 } from "@/lib/social/thumbnail";
import { getDecidedProposals, type ContentType } from "@/lib/social/store";

const MAX_CANDIDATES = 20;
const MAX_REFERENCES_PER_SIDE = 3;

export type RankedPick = {
  chosenId: string;
  /** Vsi file ID-ji (vključno z chosenId), ki so vizualno del iste skupine. */
  groupFileIds: string[];
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RANK_SYSTEM_PROMPT = `Pomagaš izbrati eno fotografijo za Instagram objavo znamke Us & Cheesecake
izmed več kandidatk. Nekatere fotografije so si lahko zelo podobne (isti
posnetek iz burst-a, ista torta iz skoraj enakega kota) - te združi v
skupine.

Za vsako skupino vizualno podobnih/skoraj podvojenih fotografij (skupina je
lahko tudi ena sama fotografija, če ni podobna nobeni drugi) izberi
najboljšo v skupini glede na: ostrino/fokus, osvetlitev, kompozicijo in
apetitnost (kako privlačno je videti hrano). Nato izmed najboljših
predstavnic vseh skupin izberi eno, ki jo priporočaš za objavo zdaj.

IZHOD: Vrni SAMO veljaven JSON, brez razlage, natanko v tej obliki:
{"groups":[{"fileIds":["id1","id2"],"bestFileId":"id1"},{"fileIds":["id3"],"bestFileId":"id3"}],"recommendedFileId":"id1"}

fileIds v izhodu morajo biti točno tisti ID-ji, ki so ti bili podani (glej
oznake "ID: ..." pred vsako sliko), brez sprememb.

Morda dobiš na začetku tudi REFERENČNE fotografije (označene z
"REFERENCA"): to so pretekli predlogi, ki jih je Urh POTRDIL (taka izbira
mu ustreza) ali ZAVRNIL (taka izbira mu ne ustreza). Niso kandidatke in
njihovih ID-jev ne vračaj - uporabi jih samo kot vodilo pri končni izbiri.`;

/**
 * Med več kandidatnimi fotografijami z Anthropic vision klicem prepozna
 * vizualno podobne/skoraj podvojene posnetke, izbere najboljšo v vsaki
 * skupini in priporoči eno za objavo. Ob napaki (API, parsing) se tiho
 * vrne na naključno izbiro, da to ni edina točka odpovedi celotnega crona.
 */
/**
 * Thumbnaili zadnjih potrjenih/zavrnjenih fotografij danega tipa, ki jih
 * rank klic dobi kot referenco Urhovega okusa. Ob kakršni koli napaki
 * (Redis, Drive datoteka izbrisana) se referenca preprosto izpusti.
 */
async function referenceContent(type: ContentType): Promise<Array<Record<string, unknown>>> {
  const decided = await getDecidedProposals(type, 20).catch(() => []);
  const images = decided.filter((p) => p.kind === "IMAGE");
  const picks = [
    ...images.filter((p) => p.status === "done").slice(0, MAX_REFERENCES_PER_SIDE),
    ...images.filter((p) => p.status === "rejected").slice(0, MAX_REFERENCES_PER_SIDE),
  ];

  const thumbs = await Promise.all(
    picks.map(async (p) => {
      try {
        return { p, base64: await makeThumbnailBase64(p.driveFileId) };
      } catch {
        return null;
      }
    })
  );

  const content: Array<Record<string, unknown>> = [];
  for (const t of thumbs) {
    if (!t) continue;
    const verdict =
      t.p.status === "done"
        ? "REFERENCA - Urh je POTRDIL"
        : `REFERENCA - Urh je ZAVRNIL${t.p.rejectReason ? ` (razlog: ${t.p.rejectReason.slice(0, 200)})` : ""}`;
    content.push({ type: "text", text: verdict });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: t.base64 },
    });
  }
  if (content.length > 0) {
    content.push({ type: "text", text: "--- Konec referenc. Spodaj so KANDIDATKE: ---" });
  }
  return content;
}

export async function pickBestImage(
  candidates: DriveFile[],
  type: ContentType
): Promise<RankedPick | null> {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { chosenId: candidates[0].id, groupFileIds: [candidates[0].id] };
  }

  const pool = shuffle(candidates).slice(0, MAX_CANDIDATES);

  try {
    const [thumbs, references] = await Promise.all([
      Promise.all(
        pool.map(async (file) => ({ file, base64: await makeThumbnailBase64(file.id) }))
      ),
      referenceContent(type),
    ]);

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: RANK_SYSTEM_PROMPT },
      ...references,
    ];
    for (const t of thumbs) {
      content.push({ type: "text", text: `ID: ${t.file.id} (${t.file.name})` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: t.base64 },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${await response.text()}`);
    }

    const data = await response.json();
    const text: string = extractAnthropicText(data) || "{}";
    const parsed = extractJson<{
      groups?: Array<{ fileIds: string[]; bestFileId: string }>;
      recommendedFileId?: string;
    }>(text);

    const validIds = new Set(pool.map((f) => f.id));
    const recommended = parsed.recommendedFileId;
    if (recommended && validIds.has(recommended)) {
      const group = parsed.groups?.find((g) => g.fileIds?.includes(recommended));
      const groupFileIds = (group?.fileIds ?? [recommended]).filter((id) => validIds.has(id));
      return { chosenId: recommended, groupFileIds: groupFileIds.length ? groupFileIds : [recommended] };
    }
  } catch (error) {
    console.error("pickBestImage: AI ranking failed, falling back to random", error);
  }

  const fallback = pool[Math.floor(Math.random() * pool.length)];
  return { chosenId: fallback.id, groupFileIds: [fallback.id] };
}
