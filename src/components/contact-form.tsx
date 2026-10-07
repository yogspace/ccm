import { Check, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./button";
import CookieIcon from "./cookie-icon";

type Status = "idle" | "sending" | "sent" | "error";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The contact form in the imprint – so the imprint needs no link to another
 * site. Sent to /next/contact, which mails it on; nothing is stored.
 */
const ContactForm = () => {
  const { t } = useTranslation();
  const ids = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const filled = (key: string) => String(data[key] ?? "").trim();
    if (!(filled("name") && filled("message") && EMAIL.test(filled("email")))) {
      setProblem(t("contact.invalid"));
      setStatus("error");
      return;
    }
    setProblem(null);
    setStatus("sending");
    try {
      const response = await fetch("/next/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        form.reset();
        setStatus("sent");
        return;
      }
      setProblem(
        response.status === 429
          ? t("contact.rateLimited")
          : response.status === 400
            ? t("contact.invalid")
            : t("contact.error")
      );
    } catch {
      setProblem(t("contact.error"));
    }
    setStatus("error");
  };

  // A new message begins: the thanks goes.
  const typing = () => {
    if (status === "sent" || status === "error") setStatus("idle");
  };

  return (
    <form className="contact-form" noValidate onSubmit={submit}>
      <p>{t("contact.intro")}</p>
      <div className="contact-names">
        <label className="composer-field" htmlFor={`${ids}-name`}>
          <span>{t("contact.name")}</span>
          <input
            autoComplete="name"
            id={`${ids}-name`}
            maxLength={200}
            name="name"
            onInput={typing}
          />
        </label>
        <label className="composer-field" htmlFor={`${ids}-email`}>
          <span>{t("contact.email")}</span>
          <input
            autoComplete="email"
            id={`${ids}-email`}
            maxLength={200}
            name="email"
            onInput={typing}
            type="email"
          />
        </label>
      </div>
      <label className="composer-field" htmlFor={`${ids}-message`}>
        <span>{t("contact.message")}</span>
        <textarea
          id={`${ids}-message`}
          maxLength={5000}
          name="message"
          onInput={typing}
          rows={4}
        />
      </label>
      {/* Honeypot – hidden from people, bots fill it in. */}
      <input
        aria-hidden
        autoComplete="off"
        className="contact-trap"
        name="website"
        tabIndex={-1}
      />
      <div className="contact-send">
        <Button
          className="primary"
          disabled={status === "sending"}
          type="submit"
        >
          <CookieIcon icon={Send} roll={-8} size={48} />
          {status === "sending" ? t("contact.sending") : t("contact.send")}
        </Button>
        <AnimatePresence mode="wait">
          {status === "sent" && (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="contact-sent"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, y: 6 }}
              key="sent"
              role="status"
            >
              <CookieIcon icing="#00b86b" icon={Check} size={36} />
              {t("contact.sent")}
            </motion.span>
          )}
          {status === "error" && problem && (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="contact-problem"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0, y: 6 }}
              key="problem"
              role="alert"
            >
              {problem}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
};

export default ContactForm;
