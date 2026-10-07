import { Pencil, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { setName, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";

/**
 * The drawing card's title is the creation's name, written right there – no
 * second heading, no extra bar. A field from the start: “Shape” as the
 * placeholder and a pencil; a click turns the placeholder into the hint to
 * type a name. A long name stays on one line, cut with “…”; a cross clears it.
 */
const TitleField = () => {
  const { t } = useTranslation();
  // Synchronous – otherwise the caret jumps to the end while typing.
  const { name } = useSnapshot(store, { sync: true });
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="title-field">
      <input
        aria-label={t("export.name")}
        className="card-title"
        enterKeyHint="done"
        maxLength={60}
        onBlur={() => setFocused(false)}
        onChange={(event) => setName(event.target.value)}
        onFocus={() => setFocused(true)}
        // Enter just finishes, like in any title.
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder={focused ? t("export.namePlaceholder") : t("steps.shape")}
        ref={inputRef}
        spellCheck={false}
        title={name.trim() || t("export.name")}
        type="text"
        value={name}
      />
      {!name && (
        <span aria-hidden className="title-pencil">
          <CookieIcon
            className="title-pencil-icon"
            icing="#2a44ff"
            icon={Pencil}
            interactive={false}
            roll={-12}
            size={40}
          />
        </span>
      )}
      {name && (
        <Button
          aria-label={t("export.clearName")}
          className="icon title-clear"
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
  );
};

export default TitleField;
