import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAgentAuthorized } from "@/lib/social/auth";
import { getProposal } from "@/lib/social/store";
import { getFileBuffer } from "@/lib/drive";

// sharp in googleapis potrebujeta Node runtime (native bindings), ne edge.
export const runtime = "nodejs";

const MAX_DIMENSION = 1600;

/**
 * Vrne IZVIRNO fotografijo za dani proposal - agent slike ne obreže, ne
 * ureja barv in ne vžiga besedila (glej README: to je bila prejšnja
 * zasnova, opuščena, ker je Vercel strežnik brez fontov za šumnike
 * izpisoval prazne znake, poleg tega je Urh raje ohranja polni nadzor nad
 * vizualnim urejanjem v Instagram aplikaciji). Edina obdelava je smiseln
 * resize za hitrejši prikaz na `/pregled` (ne spremeni razmerja/barv).
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

  const download = request.nextUrl.searchParams.get("download") === "1";
  const original = await getFileBuffer(proposal.driveFileId);

  const output = download
    ? original
    : await sharp(original)
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();

  const headers = new Headers({
    "Content-Type": download ? proposal.mimeType : "image/jpeg",
    "Cache-Control": "no-store",
  });
  if (download) {
    const ext = proposal.driveFileName.includes(".")
      ? proposal.driveFileName.slice(proposal.driveFileName.lastIndexOf("."))
      : ".jpg";
    headers.set("Content-Disposition", `attachment; filename="${proposal.id.slice(0, 8)}${ext}"`);
  }

  return new NextResponse(new Uint8Array(output), { headers });
}
