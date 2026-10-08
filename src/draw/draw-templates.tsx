import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "../assets";
import { cn } from "../cn";
import Button from "../components/button";
import CookieIcon from "../components/cookie-icon";
import { cookieInButton } from "../components/styles";
import { loadPreset, type Preset, type PresetShape } from "../presets";

type Props = {
  onInsert: (preset: Preset) => void;
  onImport: (file: File) => void;
};

/**
 * Templates: heading, below it the cards (scrolling sideways), below them
 * “Upload SVG”. At least four cards fit side by side. Beside the area:
 * stacked, scrolling down, no heading.
 */
const DrawTemplates = ({ onInsert, onImport }: Props) => {
  const { t, i18n } = useTranslation();
  const { presets } = useAssets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [shapes, setShapes] = useState<Record<string, PresetShape>>({});

  // Load the templates' outlines for their cards.
  useEffect(() => {
    let cancelled = false;
    for (const preset of presets) {
      loadPreset(preset).then(
        (shape) => {
          if (!cancelled) {
            setShapes((current) => ({ ...current, [preset.id]: shape }));
          }
        },
        (error) => console.error(error)
      );
    }
    return () => {
      cancelled = true;
    };
  }, [presets]);

  const presetName = (preset: Preset) =>
    preset.name[i18n.resolvedLanguage === "de" ? "de" : "en"];

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 [grid-area:templates] beside:min-h-0 beside:items-center beside:gap-3 beside:self-stretch">
      <span
        aria-hidden
        className="text-small font-bold tracking-label text-muted uppercase beside:hidden"
      >
        {t("draw.presets")}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form */}
      <div
        aria-label={t("draw.presets")}
        className="flex min-w-0 snap-x gap-2.5 self-stretch overflow-x-auto overscroll-contain py-0.5 [scrollbar-color:color-mix(in_oklab,var(--color-muted)_45%,transparent)_transparent] scrollbar-thin *:flex-none *:snap-start beside:min-h-0 beside:flex-1 beside:snap-y beside:flex-col beside:items-center beside:overflow-x-hidden beside:overflow-y-auto beside:scrollbar-none"
        role="group"
      >
        {presets.map((preset) => {
          const shape = shapes[preset.id];
          const name = t("draw.insert", { name: presetName(preset) });
          return (
            // The column beside the area clips at the sides – so there the
            // focus ring sits inside.
            <Button
              aria-label={name}
              className="size-12 rounded-xl bg-paper p-1.5 text-[#0d1033] beside:focus-visible:-outline-offset-3"
              disabled={!shape}
              key={preset.id}
              onClick={() => onInsert(preset)}
              title={name}
              type="button"
            >
              {shape && (
                <svg
                  aria-hidden
                  className="size-full fill-none stroke-current stroke-[1.8] [stroke-linejoin:round]"
                  viewBox="0 0 24 24"
                >
                  <path d={shape.path} />
                </svg>
              )}
            </Button>
          );
        })}
      </div>
      {/* Beside the area a tile like the templates: just the cookie, the
          text then only for screen readers and as the tooltip. */}
      <Button
        className="mt-2 beside:relative beside:m-0 beside:size-12 beside:flex-none beside:rounded-xl beside:p-0"
        onClick={() => inputRef.current?.click()}
        title={t("draw.upload")}
        type="button"
      >
        <CookieIcon
          className={cn(cookieInButton, "beside:-m-2.5")}
          icing="#2a44ff"
          icon={Upload}
          roll={10}
          size={58}
        />
        <span className="beside:sr-only">{t("draw.upload")}</span>
      </Button>
      <input
        accept=".svg,image/svg+xml,image/png"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
};

export default DrawTemplates;
