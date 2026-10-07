import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
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
import { Legal } from "./globals/legal";
import { Site } from "./globals/site";
import { Translations } from "./globals/translations";
import { seedLegal, seedSite } from "./legal/seed";
import { LOCALES } from "./seo";
import { seedAdmin } from "./stats/seed-admin";
import { seedTranslations } from "./translations/seed";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The backend: an admin for the anonymous statistics, the interface texts,
 * the templates and the gallery pictures, the links and the legal text. The
 * editor itself stays in the browser.
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
  // The admin's groups follow this order: Users, then Content, then Settings.
  collections: [Users, Templates, Gallery, PageViews, Actions],
  globals: [Site, Legal, Translations, Analytics],
  // The legal text brings its own editor (globals/legal.ts); this is the
  // default for any other rich text.
  editor: lexicalEditor(),
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
  // What is missing at every start: the first admin, the interface texts,
  // links and address, the legal text. Errors must not stop the start – the
  // site falls back to the code's versions.
  onInit: async (payload) => {
    for (const [task, run] of [
      ["Admin", seedAdmin],
      ["Translations", seedTranslations],
      ["Site", seedSite],
      ["Legal", seedLegal],
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
