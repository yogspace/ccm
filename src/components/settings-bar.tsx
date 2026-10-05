import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

type Props = PropsWithChildren<{
  name: string;
  onNameChange: (name: string) => void;
}>;

/** Leiste über beiden Fenstern: Dateiname links, `children` (Teilen) rechts. */
const SettingsBar = ({ name, onNameChange, children }: Props) => {
  const { t } = useTranslation();

  return (
    <section className="card bar">
      <label className="bar-field">
        <span>{t("export.name")}</span>
        <input
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
