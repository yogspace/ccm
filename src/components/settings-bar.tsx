import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { setName, store } from "../store";

/** Leiste über beiden Fenstern: Name der Kreation links, `children` (Teilen) rechts. Die Beschriftung steckt im Platzhalter. */
const SettingsBar = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  // Synchron, sonst springt der Cursor im Eingabefeld ans Ende.
  const { name } = useSnapshot(store, { sync: true });

  return (
    <section className="card bar">
      <label className="bar-field">
        <input
          aria-label={t("export.name")}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("export.namePlaceholder")}
          type="text"
          value={name}
        />
      </label>
      {children}
    </section>
  );
};

export default SettingsBar;
