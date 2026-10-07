/**
 * Outgoing mail via the Resend HTTP API (port 443) – Hetzner blocks outgoing
 * SMTP. Configured by RESEND_API_KEY and MAIL_FROM (a domain verified at
 * Resend); without them nothing is sent.
 */
type SendMailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Answers go here (the contact form: whoever wrote). */
  replyTo?: string;
};

type SendMailResult = { ok: true } | { ok: false; error: string };

export const sendMail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendMailArgs): Promise<SendMailResult> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Mail not configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
        ...(html && { html }),
        ...(replyTo && { reply_to: replyTo }),
      }),
    });
    if (!response.ok) {
      // The real error goes to the log, never to the caller.
      console.error(
        "[send-mail] Resend failed:",
        response.status,
        await response.text()
      );
      return { ok: false, error: "Send failed" };
    }
    return { ok: true };
  } catch (error) {
    console.error("[send-mail] Resend request failed:", error);
    return { ok: false, error: "Send failed" };
  }
};
