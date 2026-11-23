/**
 * A made-up name for a visit (“Quiet Otter”), so the admin can talk about
 * “the Otter who read Firefly” instead of a hex id. Derived only from the
 * visit's random id, which lives in one tab – the same person gets a new
 * name after a reload. Nothing about the visitor goes into it.
 */

const ADJECTIVES = [
  "Amber",
  "Brave",
  "Bright",
  "Calm",
  "Clever",
  "Cosy",
  "Curious",
  "Dapper",
  "Eager",
  "Fuzzy",
  "Gentle",
  "Golden",
  "Happy",
  "Humble",
  "Jolly",
  "Keen",
  "Lively",
  "Lucky",
  "Mellow",
  "Merry",
  "Misty",
  "Nimble",
  "Noble",
  "Plucky",
  "Polite",
  "Quick",
  "Quiet",
  "Rosy",
  "Rusty",
  "Shy",
  "Silver",
  "Sleepy",
  "Snappy",
  "Sneaky",
  "Sunny",
  "Swift",
  "Tidy",
  "Velvet",
  "Witty",
  "Zesty",
] as const;

const ANIMALS = [
  "Alpaca",
  "Badger",
  "Beaver",
  "Bison",
  "Crane",
  "Crow",
  "Dingo",
  "Dolphin",
  "Falcon",
  "Ferret",
  "Finch",
  "Fox",
  "Gecko",
  "Heron",
  "Hedgehog",
  "Ibis",
  "Koala",
  "Lemur",
  "Lynx",
  "Marten",
  "Moose",
  "Newt",
  "Ocelot",
  "Otter",
  "Owl",
  "Panda",
  "Pelican",
  "Puffin",
  "Quokka",
  "Raven",
  "Robin",
  "Seal",
  "Sloth",
  "Squirrel",
  "Stoat",
  "Tapir",
  "Toucan",
  "Walrus",
  "Wombat",
  "Yak",
] as const;

/** FNV-1a – small, stable and spreads short ids evenly. */
const hash = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** The same id always gives the same name. */
export const visitName = (id: string) => {
  const h = hash(id);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length];
  return `${adjective} ${animal}`;
};

/** The flag emoji of an ISO country code (“DE” → 🇩🇪) – empty if it isn't one. */
export const countryFlag = (code: string) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(
        ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
      )
    : "";
