import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/social/auth";
import { runProposal } from "@/lib/social/propose";
import { sendNotificationEmail } from "@/lib/social/notify";

/**
 * Sprožen tedensko prek native Vercel Cron (glej vercel.json).
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const proposal = await runProposal("POST");
    return NextResponse.json({ ok: true, proposalId: proposal?.id ?? null });
  } catch (error) {
    try {
      await sendNotificationEmail(
        "Priprava tedenskega IG posta ni uspela",
        `<pre>${String(error)}</pre>`
      );
    } catch (notifyError) {
      console.error("Failed to send failure notification email", notifyError);
    }
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
