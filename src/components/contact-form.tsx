"use client";

import { Check, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../cn";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import Field from "./field";
import { cookieInButton, fieldInput } from "./styles";

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
    // The fields look like the card composer's.
    <form className="mb-2 grid gap-1" noValidate onSubmit={submit}>
      <p>{t("contact.intro")}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-3">
        <Field htmlFor={`${ids}-name`} label={t("contact.name")}>
          <input
            autoComplete="name"
            className={cn(fieldInput, "h-10.5")}
            id={`${ids}-name`}
            maxLength={200}
            name="name"
            onInput={typing}
          />
        </Field>
        <Field htmlFor={`${ids}-email`} label={t("contact.email")}>
          <input
            autoComplete="email"
            className={cn(fieldInput, "h-10.5")}
            id={`${ids}-email`}
            maxLength={200}
            name="email"
            onInput={typing}
            type="email"
          />
        </Field>
      </div>
      <Field htmlFor={`${ids}-message`} label={t("contact.message")}>
        <textarea
          className={cn(
            fieldInput,
            "field-sizing-content min-h-19.25 resize-none leading-[1.4]"
          )}
          id={`${ids}-message`}
          maxLength={5000}
          name="message"
          onInput={typing}
          rows={4}
        />
      </Field>
      {/* Honeypot – out of sight and reach, but not display:none (bots skip
          that); bots fill it in. */}
      <input
        aria-hidden
        autoComplete="off"
        className="pointer-events-none absolute size-px overflow-hidden opacity-0"
        name="website"
        tabIndex={-1}
      />
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button disabled={status === "sending"} kind="primary" type="submit">
          <CookieIcon
            className={cookieInButton}
            icon={Send}
            roll={-8}
            size={48}
          />
          {status === "sending" ? t("contact.sending") : t("contact.send")}
        </Button>
        <AnimatePresence mode="wait">
          {status === "sent" && (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 text-small font-bold"
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
              className="inline-flex items-center gap-1.5 text-small font-bold text-neon"
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
