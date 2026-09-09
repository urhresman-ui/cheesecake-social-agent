import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { updateProposal } from "@/lib/social/store";

export async function POST(request: NextRequest) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { proposalId } = await request.json();
  if (!proposalId) {
    return new NextResponse("Missing proposalId", { status: 400 });
  }

  const updated = await updateProposal(proposalId, { status: "rejected" });
  if (!updated) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ proposal: updated });
}
