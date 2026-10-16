import type { Proposal } from "@/lib/social/store";

const MAX_EXAMPLES = 6;

function oneLine(text: string | undefined, max = 220): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Besedilo, ki ga je Urh dejansko videl/uporabil za ta tip predloga. */
function finalText(p: Proposal): string | undefined {
  return p.type === "POST" ? p.caption : p.shortText ?? p.caption;
}

function draftedText(p: Proposal): string | undefined {
  // Stari predlogi (pred uvedbo draftedCaption) nimajo izvirnika - takrat
  // velja, da je končno besedilo enako izvirnemu.
  return p.type === "POST" ? p.draftedCaption ?? p.caption : p.draftedShortText ?? p.shortText;
}

/**
 * Iz Urhovih preteklih odločitev (potrjeno = dober predlog, zavrnjeno =
 * slab predlog) sestavi razdelek sistemskega prompta, da se agent uči,
 * kaj Urhu ustreza. Pri potrjenih predlogih, ki jih je Urh pred objavo
 * popravil, pokaže tudi izvirnik -> popravek.
 */
export function feedbackPromptSection(decided: Proposal[]): string {
  const approved = decided.filter((p) => p.status === "done").slice(0, MAX_EXAMPLES);
  const rejected = decided.filter((p) => p.status === "rejected").slice(0, MAX_EXAMPLES);
  if (approved.length === 0 && rejected.length === 0) return "";

  const approvedLines = approved.map((p) => {
    const final = oneLine(finalText(p));
    const drafted = oneLine(draftedText(p));
    return drafted && drafted !== final
      ? `- Tvoj predlog: "${drafted}"\n  Urh ga je popravil in objavil kot: "${final}"`
      : `- "${final}" (objavljeno brez popravkov)`;
  });

  const rejectedLines = rejected.map((p) => {
    const reason = p.rejectReason ? ` (razlog: ${oneLine(p.rejectReason, 200)})` : "";
    return `- "${oneLine(draftedText(p) ?? finalText(p))}"${reason}`;
  });

  return `
URHOVA POVRATNA INFORMACIJA NA TVOJE PRETEKLE PREDLOGE (od najnovejše) -
to so dejanske Urhove odločitve, upoštevaj jih bolj kot splošna navodila:
${approvedLines.length ? `\nPOTRJENI (dobri) predlogi - ta smer mu ustreza; kjer jih je popravil, se nauči iz popravka:\n${approvedLines.join("\n")}\n` : ""}${rejectedLines.length ? `\nZAVRNJENI (slabi) predlogi - izogibaj se podobnemu tonu, temam in formulacijam:\n${rejectedLines.join("\n")}\n` : ""}
Ne kopiraj teh besedil dobesedno, uporabi jih kot vodilo za slog.
`;
}
