import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

/**
 * Dev server only: the app posts the drawing on screen as a geometry test case
 * (its “Test case” button, see src/components/dev-fixture.tsx) – it lands in test/fixtures/.
 */
export const POST = async (request: Request) => {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  try {
    const { name, ...fixture } = await request.json();
    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("No name");
    const file = join(process.cwd(), "test", "fixtures", `${slug}.json`);
    await writeFile(file, JSON.stringify(fixture));
    // Formatted as Biome wants it, or the lint (and the pipeline) fails.
    await promisify(execFile)(
      join(process.cwd(), "node_modules", ".bin", "biome"),
      ["format", "--write", file]
    ).catch(() => undefined);
    return new Response(slug);
  } catch {
    return new Response(null, { status: 400 });
  }
};
