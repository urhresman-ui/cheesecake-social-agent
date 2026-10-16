import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { getProposal, updateProposal, markFilesUsed } from "@/lib/social/store";

/**
 * Urh predlog zavrne = predlog ni bil dober. Shrani se kot negativen primer
 * (z neobveznim razlogom), ki ga agent upošteva pri naslednjih predlogih
 * (lib/social/feedback.ts). Fotografija (in njej podobne) se za ta tip
 * izločijo iz nadaljnjega izbora, da se isti zavrnjen posnetek ne vrača.
 */
export async function POST(request: NextRequest) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { proposalId, reason } = await request.json();
  if (!proposalId) {
    return new NextResponse("Missing proposalId", { status: 400 });
  }

  const proposal = await getProposal(proposalId);
  if (!proposal) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rejectedIds = new Set([proposal.driveFileId, ...(proposal.siblingFileIds ?? [])]);
  await markFilesUsed(proposal.type, [...rejectedIds]);
  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  const updated = await updateProposal(proposalId, {
    status: "rejected",
    completedAt: Date.now(),
    ...(trimmedReason ? { rejectReason: trimmedReason } : {}),
  });

  return NextResponse.json({ proposal: updated });
}
