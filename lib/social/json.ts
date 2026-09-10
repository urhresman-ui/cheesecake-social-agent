/**
 * Anthropic modeli včasih odgovor zavijejo v ```json ... ``` ograjice kljub
 * eksplicitnemu navodilu, da naj tega ne storijo. Ta helper robustno izvleče
 * JSON iz surovega besedila, preden ga parsira.
 */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(text) as T;
}
