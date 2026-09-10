import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { getProposal } from "@/lib/social/store";
import { getFileBuffer } from "@/lib/drive";
import { renderEditedImage } from "@/lib/social/image";

// sharp in googleapis potrebujeta Node runtime (native bindings), ne edge.
export const runtime = "nodejs";

/**
 * Vrne urejeno (obrezano, s presetom, po želji z vžganim besedilom)
 * različico fotografije za dani proposal. Besedilo se generira sproti iz
 * `text` query parametra, da se predogled na /pregled osveži ob urejanju
 * captiona, brez shranjevanja vmesne slike.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (proposal.kind !== "IMAGE") {
    return new NextResponse("Ta proposal ni fotografija", { status: 400 });
  }

  const text = request.nextUrl.searchParams.get("text") ?? proposal.burnText ?? "";
  const download = request.nextUrl.searchParams.get("download") === "1";

  const original = await getFileBuffer(proposal.driveFileId);
  const edited = await renderEditedImage(original, { type: proposal.type, text });

  const headers = new Headers({
    "Content-Type": "image/jpeg",
    "Cache-Control": "no-store",
  });
  if (download) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${proposal.type.toLowerCase()}-${proposal.id.slice(0, 8)}.jpg"`
    );
  }

  return new NextResponse(new Uint8Array(edited), { headers });
}
