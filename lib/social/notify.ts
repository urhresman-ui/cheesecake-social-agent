export async function sendNotificationEmail(subject: string, html: string) {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Us & Cheesecake social <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error: ${await response.text()}`);
  }
}
