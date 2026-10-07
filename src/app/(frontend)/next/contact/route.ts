import { NextResponse } from "next/server";
import { sendMail } from "@/stats/send-mail";

/**
 * The contact form in the imprint (components/contact-form.tsx): name, email
 * and message go by mail to MAIL_CONTACT_RECIPIENT (via Resend) – nothing is
 * stored.
 */
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A simple rate limit in memory (one container): at most this many messages
// per IP and window. The IP stays in memory for the window, never on disk.
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

const limited = (ip: string, now: number) => {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Forget whoever has been quiet for a window.
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > LIMIT;
};

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const POST = async (request: Request) => {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip, Date.now())) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Honeypot: a field people never see – bots fill it. Pretend success.
  if (text(body.website)) return NextResponse.json({ ok: true });

  const name = text(body.name);
  const email = text(body.email);
  const message = text(body.message);
  if (!(name && message && EMAIL.test(email))) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return NextResponse.json({ error: "Too long" }, { status: 400 });
  }

  // The recipient comes from the server's environment – never from the form.
  const recipient = process.env.MAIL_CONTACT_RECIPIENT;
  if (!(recipient && EMAIL.test(recipient))) {
    return NextResponse.json(
      { error: "No recipient configured" },
      { status: 500 }
    );
  }

  const result = await sendMail({
    to: recipient,
    replyTo: email,
    subject: `Cookie Cutter Maker · Kontakt: ${name}`,
    text: `Von: ${name} <${email}>\n\n${message}`,
  });
  if (!result.ok) {
    const status = result.error === "Mail not configured" ? 500 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
};
