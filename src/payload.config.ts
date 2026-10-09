import path from "node:path";
import { fileURLToPath } from "node:url";
import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { de } from "@payloadcms/translations/languages/de";
import { en } from "@payloadcms/translations/languages/en";
import { buildConfig } from "payload";
import sharp from "sharp";
import { Accounts } from "./collections/accounts";
import { Actions } from "./collections/actions";
import { Gallery } from "./collections/gallery";
import { Media } from "./collections/media";
import { PageViews } from "./collections/page-views";
import { ShortLinks } from "./collections/short-links";
import { Templates } from "./collections/templates";
import { Users } from "./collections/users";
import { Analytics } from "./globals/analytics";
import { Legal } from "./globals/legal";
import { Site } from "./globals/site";
import { Translations } from "./globals/translations";
import { SEEDS_PATH } from "./seeds/definitions";
import { seedEndpoint } from "./seeds/endpoint";
import { LOCALES } from "./seo";
import { seedAdmin } from "./stats/seed-admin";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The backend: an admin for the anonymous statistics, the interface texts,
 * the templates, the gallery and its pictures, the links and the legal text –
 * and the visitors' accounts (no names, a passphrase each) with their cookie
 * jars and short links. The editor itself stays in the browser.
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
    // The Seeds page: what the code brings along for the CMS, applied by hand
    // (seeds/definitions.ts) – not at start or deploy.
    components: {
      afterNavLinks: ["@/admin/seeds-nav-link#SeedsNavLink"],
      views: {
        seeds: {
          Component: "@/admin/seeds-view#SeedsView",
          path: SEEDS_PATH,
          meta: { title: "Seeds" },
        },
      },
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
  // The admin's groups follow this order: Users, Accounts, then Content,
  // then Settings.
  collections: [
    Users,
    Accounts,
    ShortLinks,
    Templates,
    Gallery,
    Media,
    PageViews,
    Actions,
  ],
  globals: [Site, Legal, Translations, Analytics],
  endpoints: [seedEndpoint],
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
  // Image sizes of the pictures (Media).
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  // At start only the first admin (from the environment) – the content
  // seeds run from the admin's Seeds page; until then the site shows the
  // code's texts, links and legal text. Errors must not stop the start.
  onInit: async (payload) => {
    try {
      await seedAdmin(payload);
    } catch (error) {
      payload.logger.warn(
        `Admin seeding skipped: ${error instanceof Error ? error.message : error}`
      );
    }
  },
});
