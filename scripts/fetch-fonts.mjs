// Downloads the Pally font (Indian Type Foundry, ITF Free Font License) from
// Fontshare into public/fonts/. The licence allows self-hosting for your own
// website but no redistribution – so the files are not in git (public/fonts/
// is ignored) but fetched before dev/build.
//
// If the download fails, the build does not stop: the page then uses the
// system font.
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const target = fileURLToPath(new URL("../public/fonts/", import.meta.url));
const files = {
  "Fonts/WEB/fonts/Pally-Variable.woff2": "Pally-Variable.woff2",
  "License/FFL.txt": "Pally-License.txt",
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

if (await exists(join(target, "Pally-Variable.woff2"))) process.exit(0);

try {
  const response = await fetch(
    "https://api.fontshare.com/v2/fonts/download/pally"
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  await mkdir(target, { recursive: true });
  for (const [suffix, name] of Object.entries(files)) {
    const entry = Object.keys(archive).find((path) => path.endsWith(suffix));
    if (!entry) throw new Error(`${suffix} fehlt im Archiv`);
    await writeFile(join(target, name), archive[entry]);
  }
  console.info("✓ Pally nach public/fonts/ geladen");
} catch (error) {
  console.warn(
    `⚠ Pally konnte nicht geladen werden (${error.message}) – es gilt die Systemschrift.`
  );
}
