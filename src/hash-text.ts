/** A number from a text – the same text always gives the same number. */
export const hashText = (text: string) => {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
};

/** The drawing part of a link hash (`s=…`) – what makes a creation itself. */
export const drawingKey = (hash: string) =>
  new URLSearchParams(hash.replace(/^#/, "")).get("s") ?? hash;
