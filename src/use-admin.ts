import { useEffect, useState } from "react";

let asked: Promise<boolean> | null = null;

/**
 * Whether this browser is logged in to the CMS – asked once per page, of
 * Payload's own endpoint: the session cookie can't be read from here.
 * Visitor accounts are no CMS logins and don't count.
 */
const askAdmin = () => {
  asked ??= fetch("/api/users/me", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { user?: unknown } | null) => Boolean(body?.user))
    .catch(() => false);
  return asked;
};

/** True once the CMS login is confirmed – false until then and without one. */
export const useAdmin = () => {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let current = true;
    askAdmin().then((value) => {
      if (current) setAdmin(value);
    });
    return () => {
      current = false;
    };
  }, []);
  return admin;
};
