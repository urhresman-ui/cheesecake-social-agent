type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

/**
 * Nekateri modeli (npr. Claude 5 družina) lahko pred dejanskim odgovorom
 * vrnejo dodatne content bloke (npr. "thinking"), zato je bilo napačno
 * privzeti, da je besedilo vedno v content[0]. Poišče prvi blok tipa
 * "text" in vrne njegovo (obrezano) besedilo, ali prazen niz, če ga ni.
 */
export function extractAnthropicText(data: AnthropicResponse): string {
  const block = data.content?.find(
    (b): b is AnthropicContentBlock & { text: string } =>
      b.type === "text" && typeof b.text === "string"
  );
  return block?.text?.trim() ?? "";
}
