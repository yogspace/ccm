/**
 * ISO 3166-1 alpha-2 (what the location headers and GeoIP send) to the
 * numeric codes world-atlas names its countries by – “DE276”. Kosovo has no
 * ISO code and no id there; it goes by its name.
 */
const PAIRS = [
  "AE784 AF004 AL008 AM051 AO024 AQ010 AR032 AT040 AU036 AZ031 BA070",
  "BD050 BE056 BF854 BG100 BI108 BJ204 BN096 BO068 BR076 BS044 BT064",
  "BW072 BY112 BZ084 CA124 CD180 CF140 CG178 CH756 CI384 CL152 CM120",
  "CN156 CO170 CR188 CU192 CY196 CZ203 DE276 DJ262 DK208 DO214 DZ012",
  "EC218 EE233 EG818 EH732 ER232 ES724 ET231 FI246 FJ242 FK238 FR250",
  "GA266 GB826 GE268 GH288 GL304 GM270 GN324 GQ226 GR300 GT320 GW624",
  "GY328 HN340 HR191 HT332 HU348 ID360 IE372 IL376 IN356 IQ368 IR364",
  "IS352 IT380 JM388 JO400 JP392 KE404 KG417 KH116 KP408 KR410 KW414",
  "KZ398 LA418 LB422 LK144 LR430 LS426 LT440 LU442 LV428 LY434 MA504",
  "MD498 ME499 MG450 MK807 ML466 MM104 MN496 MR478 MW454 MX484 MY458",
  "MZ508 NA516 NC540 NE562 NG566 NI558 NL528 NO578 NP524 NZ554 OM512",
  "PA591 PE604 PG598 PH608 PK586 PL616 PR630 PS275 PT620 PY600 QA634",
  "RO642 RS688 RU643 RW646 SA682 SB090 SD729 SE752 SI705 SK703 SL694",
  "SN686 SO706 SR740 SS728 SV222 SY760 SZ748 TD148 TF260 TG768 TH764",
  "TJ762 TL626 TM795 TN788 TR792 TT780 TW158 TZ834 UA804 UG800 US840",
  "UY858 UZ860 VE862 VN704 VU548 YE887 ZA710 ZM894 ZW716",
  // Only in the finer 50m atlas (the mail report's map); the admin's 110m
  // map has no shape for them.
  "AD020 AG028 AW533 AX248 BB052 BH048 BM060 CV132 CW531 DM212 FM583",
  "FO234 GD308 GG831 GU316 HK344 IM833 JE832 KI296 KM174 KN659 KY136",
  "LC662 LI438 MC492 MH584 MO446 MT470 MU480 MV462 NR520 PW585 SC690",
  "SG702 SM674 ST678 TO776 VA336 VC670 WS882",
].join(" ");

const NUMERIC = new Map(
  PAIRS.split(" ").map((pair) => [pair.slice(0, 2), pair.slice(2)])
);

/** The world-atlas id of a country – or, for Kosovo, its name there. */
export const atlasKey = (alpha2: string) =>
  alpha2 === "XK" ? "Kosovo" : (NUMERIC.get(alpha2) ?? null);

const displayNames = new Map<string, Intl.DisplayNames | null>();

/** Names in a language – cached per language and kind. */
const namesIn = (locale: string, type: "region" | "language") => {
  const key = `${locale}:${type}`;
  if (!displayNames.has(key)) {
    displayNames.set(
      key,
      typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames([locale], { type })
        : null
    );
  }
  return displayNames.get(key) ?? null;
};

/**
 * “Germany” for “DE” (“Deutschland” with `locale` "de-DE" – the mail report
 * names countries in stats/config.ts' LOCALE) – the code itself where the
 * runtime has no name.
 */
export const countryName = (code: string, locale = "en") => {
  try {
    return namesIn(locale, "region")?.of(code) ?? code;
  } catch {
    return code;
  }
};

/** “German” for “de” (“Deutsch” with `locale` "de-DE"). */
export const languageName = (code: string, locale = "en") => {
  try {
    return namesIn(locale, "language")?.of(code) ?? code;
  } catch {
    return code;
  }
};
