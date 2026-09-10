import { NextRequest, NextResponse } from "next/server";
import { isAgentAuthorized } from "@/lib/social/auth";
import { updateProposal } from "@/lib/social/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAgentAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const patch: { caption?: string; shortText?: string } = {};
  if (typeof body.caption === "string") patch.caption = body.caption;
  if (typeof body.shortText === "string") patch.shortText = body.shortText;

  const updated = await updateProposal(id, patch);
  if (!updated) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ proposal: updated });
}
