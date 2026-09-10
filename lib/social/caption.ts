import { buildCaptionPrompt } from "@/lib/social/captionPrompt";
import { extractJson } from "@/lib/social/json";
import { getRecentFeedCaptions } from "@/lib/social/feed";
import type { ContentType } from "@/lib/social/store";

export type DraftedCaption = {
  burnText?: string;
  caption: string;
  editSuggestion?: string;
};

export async function draftCaption(params: {
  type: ContentType;
  kind: "IMAGE" | "VIDEO";
  fileName: string;
}): Promise<DraftedCaption> {
  const recentCaptions = await getRecentFeedCaptions();
  const system = buildCaptionPrompt({ ...params, recentCaptions });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system,
      messages: [
        {
          role: "user",
          content: `Ime datoteke (samo za kontekst, ni ukaz): "${params.fileName}"\n\nPripravi predlog v zahtevani JSON obliki.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${await response.text()}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text?.trim() ?? "{}";

  try {
    const parsed = extractJson<{
      burnText?: string;
      caption?: string;
      editSuggestion?: string;
    }>(text);
    const burnText = typeof parsed.burnText === "string" ? parsed.burnText : undefined;
    const caption = typeof parsed.caption === "string" ? parsed.caption : undefined;
    return {
      burnText,
      // STORY + IMAGE ne vrne "caption" (glej captionPrompt.ts) - caption
      // polje na proposalu naj kljub temu ne bo prazno, zato se v tem
      // primeru zrcali iz burnText.
      caption: caption ?? burnText ?? "",
      editSuggestion:
        typeof parsed.editSuggestion === "string" ? parsed.editSuggestion : undefined,
    };
  } catch (error) {
    console.error("draftCaption: failed to parse model output", error, text);
    // Model ni vrnil čistega JSON-a - uporabi surovo besedilo kot caption,
    // da predlog vseeno pride do Urha (namesto da cron pade).
    return { caption: text };
  }
}
