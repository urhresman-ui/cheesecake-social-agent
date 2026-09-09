import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { listProposals, type ProposalStatus } from "@/lib/social/store";

export async function GET(request: NextRequest) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status") as
    | ProposalStatus
    | null;
  const proposals = await listProposals(statusParam ?? undefined);
  return NextResponse.json({ proposals });
}
