import type { MeshData } from "../geometry/mesh";

/**
 * The texts for a cutter's MakerWorld upload, as a page to open next to the
 * upload form: every field with its Copy button – the description as rich
 * text (headings, bold, lists, links), everything else as plain text.
 * Always in English.
 */

/** What Cookie Cutter Maker can do – the features picture lists them too. */
export const FEATURES = [
  ["Draw it or drop in a picture", "Mouse, finger or pen – or an SVG or PNG."],
  ["Holes become inner blades", "Linked on their own: one printable piece."],
  ["Emboss the details", "A second ink presses lines into the dough."],
  ["See it in 3D", "The cutter live – and the cookie it bakes."],
  ["Ready to print", "3MF for Bambu Studio or STL, any size."],
  ["Send it as a greeting card", "Your message running around the cutter."],
] as const;

/** One word each, true of every cutter. */
const TAGS = [
  "cookiecutter",
  "cookie",
  "cookies",
  "cutter",
  "baking",
  "bake",
  "kitchen",
  "dough",
  "biscuit",
  "fondant",
  "clay",
  "gift",
];

const SITE = "https://ccm.mxwr.de";
/** MakerWorld's limit for a community post. */
const POST_LIMIT = 500;

type Texts = {
  name: string;
  dimensions: MeshData["dimensions"];
  editorUrl: string;
  cardUrl: string;
};

const html = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STYLE = `
  :root {
    --bg: #f6f4ef; --card: #ffffff; --ink: #1f2328; --muted: #6a6f76; --line: #e3dfd6;
    --accent: #ff6a1f; --accent-ink: #ffffff; --ok: #2e6b45;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #15171a; --card: #1e2125; --ink: #e9ecef; --muted: #9aa1a9; --line: #30343a;
            --accent: #ff7a35; --ok: #5fb37f; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 16px/1.55 -apple-system, "Avenir Next", "Helvetica Neue", sans-serif; }
  main { max-width: 820px; margin: 0 auto; padding: 32px 16px 80px; }
  header h1 { margin: 0 0 6px; font-size: 28px; }
  header p { margin: 0; color: var(--muted); }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; margin-top: 18px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .label { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  button { border: 0; border-radius: 999px; padding: 7px 16px; font: 600 14px/1 inherit; cursor: pointer;
           background: var(--accent); color: var(--accent-ink); white-space: nowrap; }
  button.done { background: var(--ok); }
  .plain { white-space: pre-wrap; overflow-wrap: anywhere; }
  .rich h3 { font-size: 18px; margin: 1.3em 0 .4em; }
  .rich h3:first-child { margin-top: 0; }
  .rich p, .rich ul { margin: .4em 0; }
  .rich a { color: var(--accent); }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 6px 0; }
  .row .k { flex: none; width: 92px; color: var(--muted); font-size: 14px; padding-top: 2px; }
  .row .v { flex: 1; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

// The description as rich text (HTML and plain), everything else as plain
// text; where the clipboard API is missing (some browsers on file://), the
// selection is copied instead – it keeps the formatting.
const SCRIPT = `
  async function copy(el, rich) {
    const text = el.innerText.trim();
    try {
      if (rich && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([el.innerHTML], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const ok = document.execCommand("copy");
      selection.removeAllRanges();
      return ok;
    }
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-copy]");
    if (!button) return;
    const ok = await copy(document.getElementById(button.dataset.copy), button.hasAttribute("data-rich"));
    button.textContent = ok ? "Copied ✓" : "Select & copy manually";
    button.classList.toggle("done", ok);
    setTimeout(() => { button.textContent = "Copy"; button.classList.remove("done"); }, 1800);
  });
`;

const field = (id: string, label: string, content: string, rich = false) => `
<section>
  <div class="head"><span class="label">${label}</span><button data-copy="${id}"${rich ? " data-rich" : ""}>Copy</button></div>
  <div id="${id}" class="${rich ? "rich" : "plain"}">${content}</div>
</section>`;

const row = (id: string, label: string, text: string) =>
  `<div class="row"><span class="k">${label}</span><span class="v" id="${id}">${html(text)}</span><button data-copy="${id}">Copy</button></div>`;

/** The page with every text of the upload, ready to copy field by field. */
export const makerWorldTexts = ({
  name,
  dimensions: [width, depth, height],
  editorUrl,
  cardUrl,
}: Texts) => {
  const mm = (value: number) => Math.round(value);
  const size = `${mm(width)} × ${mm(depth)} mm, ${mm(height)} mm tall`;
  const title = /cutter/i.test(name) ? name : `${name} Cookie Cutter`;
  const summary = `${title}, ${mm(width)} × ${mm(depth)} mm – ready to print. Make it yours in the free editor or send it as a greeting card.`;
  const postTitle = `🍪 ${title} – draw your own`;
  const post = `I drew this ${name} cookie cutter in my browser and printed it the same evening. 🍪

Want a different one? Cookie Cutter Maker turns any doodle or picture into a print-ready cutter – free, no account. Holes become inner blades, details can be embossed, and you can send it as a greeting card.

Try it: ccm.mxwr.de
#cookiecutter #baking`;

  const description = `
    <h3>🍪 ${html(name)}</h3>
    <p>A cookie cutter, ${size}, drawn with <b>Cookie Cutter Maker</b> – ready to print.</p>

    <h3>✏️ Make it yours</h3>
    <p>Open it in the editor, change the drawing or the size and download your own version – free, right in your browser, no account needed.</p>
    <p><a href="${html(editorUrl)}">Open ${html(name)} in the editor</a></p>

    <h3>💌 Send it as a greeting card</h3>
    <p>A page of its own with the cutter in 3D, your message running around it and the files to print.</p>
    <p><a href="${html(cardUrl)}">See the example card</a></p>

    <h3>✨ Cookie Cutter Maker</h3>
    <ul>
${FEATURES.map(([feature, about]) => `      <li><b>${feature}</b> – ${about}</li>`).join("\n")}
    </ul>
    <p>Draw your own cookie cutter from any doodle or picture: <a href="${SITE}">ccm.mxwr.de</a></p>

    <h3>🖨️ Printing</h3>
    <ul>
      <li>PLA, 0.4 mm nozzle, 0.2 mm layers – on any printer.</li>
      <li>The rim sits on the print bed, no supports needed.</li>
      <li>For dough, food-safe filament is best. Wash by hand in lukewarm water, not in the dishwasher: PLA warps from about 55 °C.</li>
    </ul>
    <p>Happy baking! 🍪</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)} – MakerWorld texts</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header>
  <h1>${html(title)} – MakerWorld texts</h1>
  <p>Click <b>Copy</b> and paste into the matching field. The description keeps its formatting (headings, bold, lists, links).</p>
</header>
${field("title", "Title", html(title))}
${field("summary", "Summary", html(summary))}
${field("tags", "Tags", html(TAGS.join(", ")))}
${field("description", "Description", description, true)}
${field("post-title", "Community post – title", html(postTitle))}
${field("post-text", `Community post – text (${[...post].length} / ${POST_LIMIT} characters)`, html(post))}
<section>
  <div class="head"><span class="label">Print profile</span></div>
  ${row("profile-name", "Name", `${title} – PLA, 0.20 mm`)}
  ${row("profile-text", "Description", `${size}. The rim sits on the bed, no supports needed. Want it bigger, smaller or different? Open it in the editor: ${editorUrl}`)}
</section>
<section>
  <div class="head"><span class="label">Links</span></div>
  ${row("link-editor", "Editor", editorUrl)}
  ${row("link-card", "Card", cardUrl)}
</section>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
};
