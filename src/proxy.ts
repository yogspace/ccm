import { type NextRequest, NextResponse } from "next/server";

/**
 * “/” and “/card” (older card links) go to the browser's language: German if
 * it comes first, English otherwise. The hash (shape, card) survives the
 * redirect in the browser. Next sends a same-origin Location as a relative
 * one, so it does not matter that the server behind the proxy does not know
 * its public address.
 */
export const proxy = (request: NextRequest) => {
  const german = /^\s*de/i.test(request.headers.get("accept-language") ?? "");
  const url = request.nextUrl.clone();
  url.pathname = `/${german ? "de" : "en"}${url.pathname === "/" ? "" : "/card"}`;
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Vary", "Accept-Language");
  return response;
};

export const config = { matcher: ["/", "/card"] };
