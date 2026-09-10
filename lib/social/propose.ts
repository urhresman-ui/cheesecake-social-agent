import { selectUnusedContent } from "@/lib/social/select";
import { draftCaption } from "@/lib/social/caption";
import { createProposal, type ContentType, type Proposal } from "@/lib/social/store";
import { sendNotificationEmail } from "@/lib/social/notify";

const BASE_URL = process.env.PUBLIC_BASE_URL ?? "";

function reviewUrl(): string {
  const token = process.env.SOCIAL_AGENT_TOKEN ?? "";
  return `${BASE_URL}/pregled?token=${encodeURIComponent(token)}`;
}

/**
 * Izbere neuporabljeno vsebino, pripravi caption prek Anthropic API-ja,
 * shrani proposal in obvesti Urha po e-pošti. Uporablja se iz obeh cron
 * poti (propose-post, propose-story). Vrne `null`, če ni več neuporabljene
 * vsebine v Drive mapi (in v tem primeru pošlje opozorilni e-mail namesto
 * predloga).
 */
export async function runProposal(type: ContentType): Promise<Proposal | null> {
  const selected = await selectUnusedContent(type);

  if (!selected) {
    await sendNotificationEmail(
      `Zmanjkalo je vsebine za ${type === "POST" ? "post" : "story"} 🍰`,
      `<p>V Google Drive mapi ni več neuporabljenih fotografij/videov za
      tip <strong>${type}</strong>. Dodaj nove datoteke v mapo, da agent
      lahko pripravi naslednji predlog.</p>`
    );
    return null;
  }

  const drafted = await draftCaption({
    type,
    kind: selected.kind,
    fileName: selected.name,
  });

  const proposal = await createProposal({
    type,
    kind: selected.kind,
    driveFileId: selected.id,
    driveFileName: selected.name,
    driveViewUrl: selected.viewUrl,
    mimeType: selected.mimeType,
    caption: drafted.caption,
    burnText: drafted.burnText,
    editSuggestion: drafted.editSuggestion,
    siblingFileIds: selected.siblingFileIds,
  });

  const label = type === "POST" ? "POST (tedenski)" : "STORY";
  await sendNotificationEmail(
    `Nov predlog za Instagram ${label} 🍰`,
    `<p>Pripravljen je nov predlog (${selected.kind === "IMAGE" ? "fotografija" : "video"}: ${selected.name}).</p>
     <p><a href="${reviewUrl()}">Odpri pregled in potrdi</a></p>`
  );

  return proposal;
}
