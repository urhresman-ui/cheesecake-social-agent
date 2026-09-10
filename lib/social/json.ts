/**
 * Anthropic modeli včasih odgovor zavijejo v ```json ... ``` ograjice ali
 * dodajo odvečne znake pred/za JSON-om (npr. osamljen `"}` na koncu) kljub
 * eksplicitnemu navodilu, da naj tega ne storijo. Ta helper robustno
 * izvleče JSON iz surovega besedila: odstrani morebitne markdown ograjice,
 * nato od prvega "{" prek pravilnega štetja gnezdenja (ki upošteva string
 * literale in escape znake, ne samo iskanje zadnjega "}" v besedilu) najde
 * dejansko ujemajoči zaključni "}" in prezre karkoli je za njim.
 */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  const start = text.indexOf("{");
  if (start === -1) {
    return JSON.parse(text) as T;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const candidate = end !== -1 ? text.slice(start, end + 1) : text.slice(start);
  return JSON.parse(candidate) as T;
}
