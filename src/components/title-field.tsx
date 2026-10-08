import { Pencil, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnapshot } from "valtio";
import { setName, store } from "../store";
import Button from "./button";
import CookieIcon from "./cookie-icon";
import { cookieInIconButton } from "./styles";

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
    <div className="relative flex max-w-md min-w-0 flex-auto items-center">
      {/* In the title's type, the field's colors – readable on its light
          ground in both modes; room on the right for the pencil or the
          cross. Focused and empty: the hint to type a name, a little
          smaller. */}
      <input
        aria-label={t("export.name")}
        className="h-12 w-full min-w-0 rounded-xl bg-field pr-12 pl-3 text-title font-bold tracking-title text-ellipsis text-field-ink outline-2 outline-transparent embolden-20 transition-[background-color,outline-color] placeholder:text-field-muted placeholder:embolden-0 hover:bg-[color-mix(in_oklab,var(--color-field)_92%,var(--color-field-ink))] focus:outline-accent focus:placeholder:text-body"
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
      {/* The pencil only says “write here” – a click goes through to the field. */}
      {!name && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 grid size-8 place-items-center"
        >
          <CookieIcon
            className="-m-1"
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
          className="absolute right-2 grid size-8 place-items-center bg-transparent p-0 [transition:opacity_0.2s_var(--ease-soft),scale_0.3s_var(--ease-spring),background_0.2s_var(--ease-soft)] starting:scale-60 starting:opacity-0"
          onClick={() => {
            setName("");
            inputRef.current?.focus();
          }}
          title={t("export.clearName")}
          type="button"
        >
          <CookieIcon
            className={cookieInIconButton}
            icing="#ff5fa8"
            icon={X}
            roll={8}
            size={40}
          />
        </Button>
      )}
    </div>
  );
};

export default TitleField;
