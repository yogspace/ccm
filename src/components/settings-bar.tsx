import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

type Props = PropsWithChildren<{
  name: string;
  onNameChange: (name: string) => void;
}>;

/** Leiste über beiden Fenstern: Dateiname links, `children` (Teilen) rechts. Die Beschriftung steckt im Platzhalter. */
const SettingsBar = ({ name, onNameChange, children }: Props) => {
  const { t } = useTranslation();

  return (
    <section className="card bar">
      <label className="bar-field">
        <input
          aria-label={t("export.name")}
          maxLength={60}
          onChange={(event) => onNameChange(event.target.value)}
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
