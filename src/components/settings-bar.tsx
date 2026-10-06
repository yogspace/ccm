import { X } from "lucide-react";
import { type PropsWithChildren, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { setName, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * Bar above both panels: name of the creation on the left (a cross clears
 * it), `children` (sharing) on the right. The label lives in the placeholder.
 */
const SettingsBar = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  // Synchronous – otherwise the caret in the input jumps to the end.
  const { name } = useSnapshot(store, { sync: true });
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="card bar">
      <div className="bar-field">
        <input
          aria-label={t("export.name")}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("export.namePlaceholder")}
          ref={inputRef}
          type="text"
          value={name}
        />
        {name && (
          <Button
            aria-label={t("export.clearName")}
            className="icon bar-clear"
            onClick={() => {
              setName("");
              inputRef.current?.focus();
            }}
            title={t("export.clearName")}
            type="button"
          >
            <CookieIcon icing="#ff5fa8" icon={X} roll={8} size={40} />
          </Button>
        )}
      </div>
      {children}
    </section>
  );
};

export default SettingsBar;
