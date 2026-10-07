import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { de } from "@payloadcms/translations/languages/de";
import { en } from "@payloadcms/translations/languages/en";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Actions } from "./collections/actions";
import { Gallery } from "./collections/gallery";
import { PageViews } from "./collections/page-views";
import { Templates } from "./collections/templates";
import { Users } from "./collections/users";
import { Analytics } from "./globals/analytics";
import { Translations } from "./globals/translations";
import { LOCALES } from "./seo";
import { seedAdmin } from "./stats/seed-admin";
import { seedTranslations } from "./translations/seed";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The backend: an admin for the anonymous statistics, the interface texts,
 * the templates and the gallery pictures. The editor itself stays in the
 * browser.
 *
 * Everything that differs between machines comes from the environment (see
 * .env.example): the database, the secrets, the mail settings.
 */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
    meta: {
      titleSuffix: " · Cookie Cutter Maker",
      icons: [{ rel: "icon", type: "image/svg+xml", url: "/favicon.svg" }],
    },
    timezones: {
      supportedTimezones: [
        { label: "Deutschland / Berlin", value: "Europe/Berlin" },
      ],
      defaultTimezone: "Europe/Berlin",
    },
  },
  i18n: {
    supportedLanguages: { de, en },
    fallbackLanguage: "de",
  },
  collections: [Templates, Gallery, Users, PageViews, Actions],
  globals: [Analytics, Translations],
  localization: {
    locales: LOCALES.map((code) => ({
      code,
      label: code === "de" ? "Deutsch" : "English",
    })),
    defaultLocale: "de",
    fallback: true,
  },
  // MongoDB without a schema of its own: the Translations global's fields
  // come from the text keys in the code, and a new key needs no migration.
  db: mongooseAdapter({
    url: process.env.DATABASE_URL ?? "",
    connectOptions: {
      serverSelectionTimeoutMS: 5000,
      // Close idle sockets before the Docker network quietly drops them –
      // otherwise the next query after a pause takes a dead one (ECONNRESET).
      maxIdleTimeMS: 10_000,
      retryReads: true,
      retryWrites: true,
    },
  }),
  secret: process.env.PAYLOAD_SECRET ?? "",
  // Image sizes of the gallery pictures.
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  // Missing interface texts and the first admin, at every start. Errors must
  // not stop the start – the site works without either.
  onInit: async (payload) => {
    for (const [task, run] of [
      ["Admin", seedAdmin],
      ["Translations", seedTranslations],
    ] as const) {
      try {
        await run(payload);
      } catch (error) {
        payload.logger.warn(
          `${task} seeding skipped: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  },
});
