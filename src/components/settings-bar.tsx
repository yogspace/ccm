import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { setName, store } from "../store";

/** Bar above both panels: name of the creation on the left, `children` (sharing) on the right. The label lives in the placeholder. */
const SettingsBar = ({ children }: PropsWithChildren) => {
  const { t } = useTranslation();
  // Synchronous – otherwise the caret in the input jumps to the end.
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
