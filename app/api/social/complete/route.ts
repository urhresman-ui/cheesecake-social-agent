import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { getProposal, updateProposal, markFileUsed } from "@/lib/social/store";

/**
 * Urh je vsebino ročno objavil v Instagram aplikaciji in to potrdi tukaj -
 * ta endpoint NE kliče Instagram API-ja, samo označi predlog kot
 * zaključen, da se ista fotografija/video ne predlaga znova za isti tip.
 */
export async function POST(request: NextRequest) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { proposalId } = await request.json();
  if (!proposalId) {
    return new NextResponse("Missing proposalId", { status: 400 });
  }

  const proposal = await getProposal(proposalId);
  if (!proposal) {
    return new NextResponse("Not found", { status: 404 });
  }

  await markFileUsed(proposal.type, proposal.driveFileId);
  const updated = await updateProposal(proposalId, {
    status: "done",
    completedAt: Date.now(),
  });

  return NextResponse.json({ proposal: updated });
}
