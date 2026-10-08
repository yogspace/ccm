import { writeFile } from "node:fs/promises";
import { join } from "node:path";

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
    await writeFile(
      join(process.cwd(), "test", "fixtures", `${slug}.json`),
      JSON.stringify(fixture)
    );
    return new Response(slug);
  } catch {
    return new Response(null, { status: 400 });
  }
};
