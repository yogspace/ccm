"use client";

import {
  FieldDescription,
  FieldError,
  FieldLabel,
  useField,
} from "@payloadcms/ui";
import type { TextFieldClientComponent } from "payload";
import { SiteColorSwatches, useSiteColors } from "./site-colors";

/**
 * A gallery card's color: one of the card colors set in Site – nothing
 * else (the collection checks it too). Empty: the first, the default.
 */
export const GalleryColorField: TextFieldClientComponent = ({
  field,
  path,
  readOnly,
}) => {
  const { value, setValue, showError, errorMessage } = useField<string>({
    path,
  });
  const colors = useSiteColors();
  const description = field.admin?.description;
  return (
    <div className="field-type gallery-color-field">
      <FieldLabel label={field.label ?? "Color"} path={path} />
      <FieldError message={errorMessage} path={path} showError={showError} />
      <SiteColorSwatches
        colors={colors}
        disabled={readOnly}
        onChange={setValue}
        value={value || null}
      />
      {typeof description === "string" && (
        <FieldDescription description={description} path={path} />
      )}
    </div>
  );
};
