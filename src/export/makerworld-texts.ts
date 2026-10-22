import type { MeshData } from "../geometry/mesh";
import { SITE } from "../seo";
import { nameTags } from "./name-tags";

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

/** MakerWorld's limit for a community post. */
const POST_LIMIT = 500;

/** A cutter of the upload: its name, its size and its links. */
type TextCutter = {
  name: string;
  dimensions: MeshData["dimensions"];
  editorUrl: string;
  cardUrl: string;
};

type Texts = {
  /** The cutter's name – or the set's. */
  name: string;
  /** The one cutter – or several, a set. */
  cutters: TextCutter[];
  /** How many plates the 3MF fills. */
  plates: number;
  /** The Terminal line that renders the photo with Blender. */
  photoCommand: string;
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
  .note { margin: 0 0 8px; color: var(--muted); font-size: 14px; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .group { margin: 12px 0 6px; font-size: 13px; color: var(--muted); }
  .group:first-of-type { margin-top: 0; }
  .tag { background: var(--line); color: var(--ink); }
  .tag.done { color: var(--accent-ink); }
  .badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
           background: var(--ok); color: #fff; font-size: 11px; vertical-align: 1px; }
`;

// The description as rich text (HTML and plain), everything else as plain
// text; where the clipboard API is missing (some browsers on file://), the
// selection is copied instead – it keeps the formatting. What was copied
// stays marked until the page is reloaded.
const SCRIPT = `
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    }
  }
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
  function markCopied(button) {
    button.classList.add("done");
    if (button.dataset.text) {
      button.textContent = "✓ " + button.dataset.text;
      return;
    }
    button.textContent = "Copy again";
    const label = button.closest(".row")?.querySelector(".k")
      ?? button.closest("section")?.querySelector(".label");
    if (label && !label.querySelector(".badge")) {
      label.insertAdjacentHTML("beforeend", '<span class="badge">Copied</span>');
    }
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-copy], button[data-text]");
    if (!button) return;
    const ok = button.dataset.text
      ? await copyText(button.dataset.text)
      : await copy(document.getElementById(button.dataset.copy), button.hasAttribute("data-rich"));
    if (ok) {
      markCopied(button);
      return;
    }
    const before = button.textContent;
    button.textContent = "Select & copy manually";
    setTimeout(() => { button.textContent = before; }, 1800);
  });
`;

const field = (id: string, label: string, content: string, rich = false) => `
<section>
  <div class="head"><span class="label">${label}</span><button data-copy="${id}"${rich ? " data-rich" : ""}>Copy</button></div>
  <div id="${id}" class="${rich ? "rich" : "plain"}">${content}</div>
</section>`;

/** Tags as buttons, each copied on its own. */
const chips = (tags: string[]) =>
  `<div class="tags">${tags.map((tag) => `<button class="tag" data-text="${html(tag)}">${html(tag)}</button>`).join("")}</div>`;

const row = (id: string, label: string, text: string) =>
  `<div class="row"><span class="k">${label}</span><span class="v" id="${id}">${html(text)}</span><button data-copy="${id}">Copy</button></div>`;

const mm = (value: number) => Math.round(value);

/** “Pumpkin, Ghost and Witch Hat” */
const listOf = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
    : names.join("");

/** What sets the upload apart: its title, tags, texts and links. */
type Upload = {
  title: string;
  /** Tags the names suggest. */
  named: string[];
  description: string;
  post: string;
  profile: string;
  links: string;
};

/** The features and the printing, below every description. */
const descriptionEnd = (printing: string) => `
    <h3>✨ Cookie Cutter Maker</h3>
    <ul>
${FEATURES.map(([feature, about]) => `      <li><b>${feature}</b> – ${about}</li>`).join("\n")}
    </ul>
    <p>Draw your own cookie cutter from any doodle or picture: <a href="${SITE}">ccm.mxwr.de</a></p>

    <h3>🖨️ Printing</h3>
    <ul>
      <li>${printing}</li>
      <li>The rim sits on the print bed, no supports needed.</li>
      <li>For dough, food-safe filament is best. Wash by hand in lukewarm water, not in the dishwasher: PLA warps from about 55 °C.</li>
    </ul>
    <p>Happy baking! 🍪</p>`;

/** One cutter: its name, its size, its two links. */
const oneCutter = (name: string, cutter: TextCutter): Upload => {
  const [width, depth, height] = cutter.dimensions;
  const { editorUrl, cardUrl } = cutter;
  const size = `${mm(width)} × ${mm(depth)} mm, ${mm(height)} mm tall`;
  // Always “Cookie Cutter - Skull”; a name that says cutter already stays.
  const title = /cutter/i.test(name) ? name : `Cookie Cutter - ${name}`;
  return {
    title,
    named: nameTags(name),
    post: `I drew this ${name} cookie cutter in my browser and printed it the same evening. 🍪

Want a different one? Cookie Cutter Maker turns any doodle or picture into a print-ready cutter – free, no account. Holes become inner blades, details can be embossed, and you can send it as a greeting card.

Try it: ccm.mxwr.de
#cookiecutter #baking`,
    description: `
    <h3>🍪 ${html(name)}</h3>
    <p>A cookie cutter, ${size}, drawn with <b>Cookie Cutter Maker</b> – ready to print.</p>

    <h3>✏️ Make it yours</h3>
    <p>Open it in the editor, change the drawing or the size and download your own version – free, right in your browser, no account needed.</p>
    <p><a href="${html(editorUrl)}">Open ${html(name)} in the editor</a></p>

    <h3>💌 Send it as a greeting card</h3>
    <p>A page of its own with the cutter in 3D, your message running around it and the files to print.</p>
    <p><a href="${html(cardUrl)}">See the example card</a></p>
${descriptionEnd("PLA, 0.4 mm nozzle, 0.2 mm layers – on any printer.")}`,
    profile: `${size}. The rim sits on the bed, no supports needed. Want it bigger, smaller or different? Open it in the editor (link in the description).`,
    links: `${row("link-editor", "Editor", editorUrl)}
  ${row("link-card", "Card", cardUrl)}`,
  };
};

/**
 * A set: all its cutters on the plate – the description lists each with
 * its size and its own links.
 */
const aSet = (name: string, cutters: TextCutter[], plates: number): Upload => {
  const title = /cutter/i.test(name) ? name : `Cookie Cutter Set - ${name}`;
  const names = cutters.map((cutter) => cutter.name);
  const list = listOf(names);
  const count = cutters.length;
  const heights = new Set(cutters.map(({ dimensions }) => mm(dimensions[2])));
  // One height for all: said once.
  const sameHeight = heights.size === 1 ? [...heights][0] : null;
  const sizeOf = ({ dimensions: [w, d, h] }: TextCutter) =>
    sameHeight === null
      ? `${mm(w)} × ${mm(d)} × ${mm(h)} mm`
      : `${mm(w)} × ${mm(d)} mm`;
  const sizes = cutters.map((cutter) => `${cutter.name} ${sizeOf(cutter)}`);
  const tall = sameHeight === null ? "" : `, all ${sameHeight} mm tall`;
  const where = plates === 1 ? "all on one plate" : `on ${plates} plates`;
  const thisSet = /\bset\b/i.test(name) ? name : `${name} set`;
  return {
    title,
    named: [...new Set([name, ...names].flatMap(nameTags))],
    post: `I drew this ${thisSet} – ${list} – in my browser and printed it the same evening. 🍪

Want different ones? Cookie Cutter Maker turns any doodle or picture into a print-ready cutter – free, no account. Holes become inner blades, details can be embossed, and you can send one as a greeting card.

Try it: ccm.mxwr.de
#cookiecutter #baking`,
    description: `
    <h3>🍪 ${html(name)}</h3>
    <p>${count} cookie cutters – ${html(list)} – drawn with <b>Cookie Cutter Maker</b>, ${where}, ready to print.</p>
    <ul>
${cutters
  .map(
    (cutter) =>
      `      <li><b>${html(cutter.name)}</b> – ${sizeOf(cutter)} · <a href="${html(cutter.editorUrl)}">Open in the editor</a> · <a href="${html(cutter.cardUrl)}">Greeting card</a></li>`
  )
  .join("\n")}
    </ul>

    <h3>✏️ Make them yours</h3>
    <p>Open any of them in the editor, change the drawing or the size and download your own version – free, right in your browser, no account needed.</p>

    <h3>💌 Send one as a greeting card</h3>
    <p>A page of its own with the cutter in 3D, your message running around it and the files to print – each cutter's card is linked above.</p>
${descriptionEnd(`${plates === 1 ? `All ${count} on one plate` : `${count} cutters on ${plates} plates`} – PLA, 0.4 mm nozzle, 0.2 mm layers, on any printer.`)}`,
    profile: `${count} cutters ${plates === 1 ? "on one plate" : `on ${plates} plates`}: ${sizes.join(", ")}${tall}. The rims sit on the bed, no supports needed. Want them bigger, smaller or different? Open them in the editor (links in the description).`,
    links: cutters
      .map(
        (cutter, i) => `<p class="group">${html(cutter.name)}</p>
  ${row(`link-editor-${i}`, "Editor", cutter.editorUrl)}
  ${row(`link-card-${i}`, "Card", cutter.cardUrl)}`
      )
      .join("\n  "),
  };
};

/** The page with every text of the upload, ready to copy field by field. */
export const makerWorldTexts = ({
  name,
  cutters,
  plates,
  photoCommand,
}: Texts) => {
  const { title, named, description, post, profile, links } =
    cutters.length === 1
      ? oneCutter(name, cutters[0])
      : aSet(name, cutters, plates);
  const general = cutters.length === 1 ? TAGS : ["set", ...TAGS];

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
  <p>Click <b>Copy</b> – or a tag – and paste into the matching field. The description keeps its formatting (headings, bold, lists, links). What you copied stays marked until you reload.</p>
</header>
${field("title", "Title", html(title))}
<section>
  <div class="head"><span class="label">Tags – one at a time</span></div>
  ${named.length > 0 ? `<p class="group">From the ${cutters.length === 1 ? "name" : "names"}</p>\n  ${chips(named)}\n  <p class="group">General</p>` : ""}
  ${chips(general.filter((tag) => !named.includes(tag)))}
</section>
${field("description", "Description", description, true)}
${field("post-text", `Community post (${[...post].length} / ${POST_LIMIT} characters)`, html(post))}
<section>
  <div class="head"><span class="label">Print profile</span></div>
  ${row("profile-name", "Name", `${title} – PLA, 0.20 mm`)}
  ${row("profile-text", "Description", profile)}
</section>
<section>
  <div class="head"><span class="label">Links</span></div>
  ${links}
</section>
<section>
  <div class="head"><span class="label">${cutters.length === 1 ? "Photo" : "Photos"} with Blender</span></div>
  <p class="note">${
    cutters.length === 1
      ? "Renders a photo-like picture of the print in the background and opens it – a minute or two."
      : "Renders photo-like pictures of the prints in the background – all of them together, then each on its own – and opens each as it is done, a minute or two apiece."
  } Paste it into Terminal: macOS won't run a downloaded script on a double-click.</p>
  ${row("photo-command", "Terminal", photoCommand)}
</section>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;
};
