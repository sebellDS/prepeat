// Recipe import from a URL (explored + decided 2026-07-12): recipe sites
// embed schema.org Recipe data for Google's rich results – JSON-LD on most,
// older microdata on some (valdemarsro.dk). We fetch the page, extract the
// recipe, and prefill the Add-recipe form for human review. Import never
// saves anything by itself.
//
// Native fetch passes many bot checks (it looks like the system browser at
// the TLS level), but not all – sites that block anyway (madensverden.dk
// did in testing) surface as a friendly error; a hidden-WebView fallback is
// the known next step if the family's sites need it.

export interface ImportedRecipe {
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  imageUrl: string | null;
  ingredients: { name: string; quantityText: string | null }[];
  steps: string[];
  /** Where it came from, stored on the recipe for attribution. */
  sourceUrl: string;
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly kind: "fetch" | "no-recipe",
  ) {
    super(message);
  }
}

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

export async function importRecipeFromUrl(
  url: string,
): Promise<ImportedRecipe> {
  const normalized = url.trim().match(/^https?:\/\//)
    ? url.trim()
    : `https://${url.trim()}`;
  let html: string;
  try {
    const response = await fetch(normalized, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    html = await response.text();
  } catch {
    throw new ImportError(
      "Couldn't reach that page – check the link, or the site may be blocking apps.",
      "fetch",
    );
  }

  const recipe = extractJsonLdRecipe(html) ?? extractMicrodataRecipe(html);
  if (recipe == null) {
    throw new ImportError(
      "No recipe found on that page – it may not be a recipe page, or the site doesn't share recipe data.",
      "no-recipe",
    );
  }
  return { ...recipe, sourceUrl: normalized };
}

// ── JSON-LD (the modern flavor, most sites) ──────────────────────────────

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

function extractJsonLdRecipe(
  html: string,
): Omit<ImportedRecipe, "sourceUrl"> | null {
  const blocks =
    html.match(
      /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
    ) ?? [];
  for (const block of blocks) {
    const raw = block
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "");
    let data: JsonValue;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (node) return normalizeJsonLd(node);
  }
  return null;
}

function findRecipeNode(data: JsonValue): JsonObject | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (data == null || typeof data !== "object") return null;
  const obj = data as JsonObject;
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe")))
    return obj;
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

function normalizeJsonLd(node: JsonObject): Omit<ImportedRecipe, "sourceUrl"> {
  const ingredients = asStringArray(
    node.recipeIngredient ?? node.ingredients,
  ).map(splitIngredient);
  return {
    title: cleanText(asString(node.name) ?? "Imported recipe"),
    description: cleanText(asString(node.description) ?? "") || null,
    servings: parseYield(node.recipeYield),
    prepMinutes: parseIsoDuration(asString(node.prepTime)),
    cookMinutes: resolveCookMinutes(
      parseIsoDuration(asString(node.prepTime)),
      parseIsoDuration(asString(node.cookTime)),
      parseIsoDuration(asString(node.totalTime)),
    ),
    imageUrl: extractImage(node.image),
    ingredients,
    steps: extractInstructions(node.recipeInstructions),
  };
}

function asString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  return [];
}

function extractImage(value: JsonValue | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? extractImage(value[0]) : null;
  if (value && typeof value === "object") {
    const url = (value as JsonObject).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

function extractInstructions(value: JsonValue | undefined): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n+/)
      .map((step) => cleanText(step))
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  const steps: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const text = cleanText(item);
      if (text) steps.push(text);
    } else if (item && typeof item === "object") {
      const obj = item as JsonObject;
      if (
        obj["@type"] === "HowToSection" &&
        Array.isArray(obj.itemListElement)
      ) {
        steps.push(...extractInstructions(obj.itemListElement));
      } else {
        const text = cleanText(asString(obj.text) ?? asString(obj.name) ?? "");
        if (text) steps.push(text);
      }
    }
  }
  return steps;
}

function parseYield(value: JsonValue | undefined): number | null {
  const text =
    typeof value === "number"
      ? String(value)
      : Array.isArray(value)
        ? asString(value[0])
        : asString(value);
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** "PT1H20M" → 80. */
export function parseIsoDuration(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return (
    Number(match[1] ?? 0) * 24 * 60 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

/**
 * Reconcile the three time fields a page may publish (prep / cook / total)
 * into the app's two (prep + cook, where the recipe screen shows
 * Total = prep + cook). When a page gives a total but no explicit cook,
 * derive cook so prep + cook = total, rather than storing the whole total AS
 * the cook – which made Total count prep twice (review #9). With only a total
 * and no prep, the total goes to cook so Total still renders correctly.
 */
export function resolveCookMinutes(
  prep: number | null,
  cook: number | null,
  total: number | null,
): number | null {
  if (cook != null) return cook;
  if (total == null) return null;
  if (prep != null) return Math.max(0, total - prep);
  return total;
}

// ── Microdata (the older flavor – e.g. valdemarsro.dk) ───────────────────

function extractMicrodataRecipe(
  html: string,
): Omit<ImportedRecipe, "sourceUrl"> | null {
  // Scope to the Recipe item so page-level itemprops (site name etc.) and
  // inline scripts that merely mention the attribute don't pollute the
  // extraction (both happened on valdemarsro.dk).
  const scopeMatch = html.match(/itemtype="[^"]*schema\.org\/Recipe"/i);
  if (!scopeMatch || scopeMatch.index == null) return null;
  const scope = html.slice(scopeMatch.index);

  const ingredients = matchAllTexts(scope, "recipeIngredient").map(
    splitIngredient,
  );
  if (ingredients.length === 0) return null;

  // Real instruction containers are HTML tags carrying the itemprop; the
  // steps are their <p>/<li> children.
  const steps: string[] = [];
  const blockRegex =
    /<[a-zA-Z][^>]*itemprop="recipeInstructions"[^>]*>([\s\S]{0,6000}?)(?=<[a-zA-Z][^>]*itemprop="|<\/section|<\/article|<script)/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(scope)) != null) {
    const block = blockMatch[1];
    const items = block.match(/<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi);
    if (items && items.length > 0) {
      for (const item of items) {
        const text = cleanText(item);
        if (text) steps.push(text);
      }
    } else {
      const text = cleanText(block);
      if (text) steps.push(text);
    }
  }

  // Times/yield can be attributes or plain span text ("PT1H15M").
  const timeOf = (prop: string) =>
    parseIsoDuration(
      matchAttr(scope, prop, "datetime") ??
        matchAttr(scope, prop, "content") ??
        matchAllTexts(scope, prop)[0] ??
        null,
    );

  const title =
    // The recipe's own name is the heading carrying the itemprop; plain
    // first-name-in-scope can be the author/site.
    cleanText(
      scope.match(/<h[12][^>]*itemprop="name"[^>]*>([^<]+)/i)?.[1] ?? "",
    ) ||
    matchAllTexts(scope, "name")[0] ||
    cleanText(
      html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? "",
    ) ||
    "Imported recipe";
  const image =
    matchAttr(scope, "image", "src") ??
    matchAttr(scope, "image", "content") ??
    html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ??
    null;

  return {
    title: cleanText(title),
    description:
      cleanText(
        html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? "",
      ) || null,
    servings: parseYield(matchAllTexts(scope, "recipeYield")[0] ?? null),
    prepMinutes: timeOf("prepTime"),
    cookMinutes: resolveCookMinutes(
      timeOf("prepTime"),
      timeOf("cookTime"),
      timeOf("totalTime"),
    ),
    imageUrl: image,
    ingredients,
    steps,
  };
}

function matchAllTexts(html: string, itemprop: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`itemprop="${itemprop}"[^>]*>([\\s\\S]*?)<`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) != null) {
    const text = cleanText(match[1]);
    if (text) results.push(text);
  }
  return results;
}

function matchAttr(
  html: string,
  itemprop: string,
  attr: string,
): string | null {
  return (
    html.match(
      new RegExp(`itemprop="${itemprop}"[^>]*${attr}="([^"]+)"`, "i"),
    )?.[1] ??
    html.match(
      new RegExp(`${attr}="([^"]+)"[^>]*itemprop="${itemprop}"`, "i"),
    )?.[1] ??
    null
  );
}

// A numeric entity, decimal or hex. Decoding the whole range beats listing
// entities one at a time: the old code knew "&#39;" but not its hex twin
// "&#x27;", so RecipeTin and Love & Lemons descriptions imported reading
// "It&#x27;s a perfect side salad".
function decodeNumericEntity(match: string, digits: string, hex: boolean) {
  const code = hex ? parseInt(digits, 16) : Number(digits);
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
  try {
    return String.fromCodePoint(code);
  } catch {
    return match; // lone surrogate or similar – leave the source text alone
  }
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (m, d: string) => decodeNumericEntity(m, d, false))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (m, d: string) =>
      decodeNumericEntity(m, d, true),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&aring;/g, "å")
    .replace(/&oslash;/g, "ø")
    .replace(/&aelig;/g, "æ")
    .replace(/&Aring;/g, "Å")
    .replace(/&Oslash;/g, "Ø")
    .replace(/&AElig;/g, "Æ")
    // Last on purpose: decoding "&amp;" first would turn a literal
    // "&amp;#39;" into "&#39;" and then into an apostrophe it never was.
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Ingredient strings → name + quantity ─────────────────────────────────
// Site strings are quantity-first ("400 g cherry tomatoes", "2 fed
// hvidløg", "1/2 tsp salt"). We split a leading amount and an optional
// known unit; the rest is the name. Unknown middle words stay in the name
// ("1 stort løg" → 1 + "stort løg").
//
// What is left after that split is a shopping-list item, so it has to read
// like one. Sites put a lot more than the ingredient in `recipeIngredient`:
// prep instructions ("onion, diced"), parentheticals ("cheese, grated (any
// melting cheese will do)"), alternatives ("spur chilies or another mild,
// red pepper"), trailing amounts ("coriander leaves, 1 large handful") and
// occasionally a whole sentence ("Prik Nam Pla (…): Mix together some fish
// sauce, …"). Left in place they end up verbatim on the shopping list, which
// is the one screen that has to be scannable in a supermarket aisle.

const UNITS = new Set([
  // metric + Danish
  "g",
  "gram",
  "grams",
  "gr",
  "kg",
  "kilogram",
  "kilograms",
  "mg",
  "ml",
  "milliliter",
  "millilitre",
  "milliliters",
  "millilitres",
  "cl",
  "dl",
  "l",
  "liter",
  "litre",
  "liters",
  "litres",
  "head",
  "heads",
  "tsk",
  "spsk",
  "knsp",
  "stk",
  "fed",
  "dåse",
  "dåser",
  "bundt",
  "håndfuld",
  "glas",
  "pakke",
  "pakker",
  "bæger",
  "skive",
  "skiver",
  "ps",
  "pose",
  "poser",
  "nip",
  "kvist",
  "kviste",
  "stilk",
  "stilke",
  "brev",
  "plade",
  "plader",
  "bakke",
  "net",
  "bundter",
  // English
  "tsp",
  "tbsp",
  "teaspoon",
  "teaspoons",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "pcs",
  "piece",
  "pieces",
  // US shorthand: "0.5 c. heavy cream". The trailing period is stripped
  // before the lookup. Deliberately NOT "t"/"T" – the lookup lowercases, so
  // teaspoon and tablespoon would collapse into one and silently halve or
  // triple the amount. Better to leave those in the name than get them wrong.
  "c",
  "clove",
  "cloves",
  "can",
  "cans",
  "pinch",
  "handful",
  "slice",
  "slices",
  "bunch",
  "sprig",
  "sprigs",
  "stick",
  "sticks",
]);

// Sites write "½ tsp" as often as "1/2 tsp"; the amount regex only knows
// ASCII, so fold the glyphs first or the whole string stays in the name.
const VULGAR_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅐": "1/7",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

// A trailing ", …" clause opening with one of these is prep or a qualifier,
// never part of what you buy. Danish included – imports are bilingual.
const PREP_CLAUSE_OPENERS = new Set([
  // English
  "diced", "sliced", "chopped", "minced", "grated", "crushed", "peeled",
  "halved", "quartered", "cubed", "shredded", "drained", "rinsed", "melted",
  "softened", "beaten", "trimmed", "cut", "torn", "crumbled", "zested",
  "juiced", "roughly", "finely", "thinly", "coarsely", "freshly", "lightly",
  "well", "to", "or", "optional", "for", "as", "plus", "divided", "packed",
  "use", "any", "your",
  "preferably", "about", "approximately", "ideally", "cooked", "uncooked",
  "raw", "at", "room",
  // Danish
  "hakket", "finthakket", "grofthakket", "revet", "snittet", "skrællet",
  "skåret", "delt", "efter", "til", "evt", "eller", "i", "ca", "gerne",
  "helst", "fint", "groft", "valgfrit", "samt", "plus", "om", "cirka",
]);

// A clause can also END in the prep word rather than open with it:
// "chicken breasts, bone and skin removed".
const PREP_CLAUSE_ENDINGS = new Set([
  "removed", "chopped", "diced", "sliced", "minced", "grated", "melted",
  "softened", "drained", "rinsed", "peeled", "trimmed", "crushed", "beaten",
  "cubed", "shredded", "halved", "quartered", "torn", "zested", "juiced",
  "crumbled", "separated", "reserved", "divided", "warmed", "chilled",
  "packed", "softened", "toasted", "sifted", "strained",
  // Danish – past participles, the usual "løg, finthakket" shape.
  "hakket", "finthakket", "grofthakket", "revet", "snittet", "skrællet",
  "smeltet", "skåret", "delt", "kogt", "stegt", "ristet", "blendet",
  "presset", "udblødt", "drænet", "skyllet", "tørret", "optøet",
  "blødgjort", "pisket", "vasket", "renset", "udstenet", "flået",
]);

// Same idea without the comma – "Jasmine rice for serving".
const TRAILING_QUALIFIERS =
  /\s+(for serving|for garnish|to serve|to taste|as needed|if desired|optional|til servering|til pynt|til drys|efter smag|efter behov|efter ønske|om ønsket|valgfrit)\.?$/i;

function tidyIngredientName(raw: string): string {
  let name = raw;

  // "Prik Nam Pla (…): Mix together some fish sauce, …" – everything after a
  // colon is the site explaining what to do, not another thing to buy.
  const colon = name.indexOf(":");
  if (colon > 0) name = name.slice(0, colon);

  // "(any melting cheese will do)", "(or sub dark soy sauce …)". Repeated,
  // because sites nest them – RecipeTin writes "(, finely chopped (brown,
  // yellow or white))" and a single pass stops at the first ")", leaving an
  // orphan bracket on the shopping list.
  for (let i = 0; i < 4; i++) {
    const stripped = name.replace(/\s*\([^()]*\)/g, " ");
    if (stripped === name) break;
    name = stripped;
  }
  // Whatever brackets survive were unbalanced in the source.
  name = name.replace(/[()]/g, " ");

  // "1 lb / 500g beef mince", "800g / 28 oz can crushed tomato" – the second
  // unit is a conversion for the reader, not a second thing to buy.
  name = name.replace(/^\s*\/\s*[\d\s.,/]+[a-z]*\s+/i, "");

  // "1 pinch of ground cumin", "2 slices of white bread"
  name = name.replace(/^(?:of|af)\s+/i, "");

  // "spur chilies or another mild, red pepper" – buy the first alternative.
  // Only when something substantial precedes the "or": in "store-bought or
  // homemade brownies" the head noun lives in the SECOND half, and cutting
  // there would leave "store-bought".
  const orCut = name.search(/\s+\b(?:or|eller)\b\s+/i);
  if (orCut > 0 && name.slice(0, orCut).trim().split(/\s+/).length >= 2) {
    name = name.slice(0, orCut);
  }

  name = name.replace(TRAILING_QUALIFIERS, "");

  // Strip trailing prep clauses, repeatedly: "long beans, cut into short
  // pieces" and "cheese, grated" both end up as the bare ingredient.
  for (let i = 0; i < 4; i++) {
    const comma = name.lastIndexOf(",");
    if (comma <= 0) break;
    const clause = name.slice(comma + 1).trim();
    const words = clause.split(/\s+/);
    const opener = words[0]?.toLowerCase().replace(/[.]$/, "");
    const ending = words[words.length - 1]?.toLowerCase().replace(/[.]$/, "");
    const isPrep =
      (opener && PREP_CLAUSE_OPENERS.has(opener)) ||
      (ending && PREP_CLAUSE_ENDINGS.has(ending));
    if (!isPrep) break;
    name = name.slice(0, comma);
  }

  // Some sites drop the comma entirely – BBC Good Food writes "300g celery
  // sliced" and "200g potatoes peeled and cut into chunks". Cut at the first
  // prep participle, but never at the first word: "shredded cheese" and
  // "crushed tomato" are what you buy, not instructions.
  // Only when the participle ENDS the string ("celery sliced") or opens a
  // conjunction ("potatoes peeled and cut into chunks"). If a noun follows it
  // instead, the participle is part of the product – "can crushed tomato",
  // "shredded cheese" – and cutting there would throw away what you buy.
  if (!name.includes(",")) {
    const words = name.split(/\s+/);
    const at = words.findIndex((w, i) => {
      if (i < 1 || !PREP_CLAUSE_ENDINGS.has(w.toLowerCase())) return false;
      const next = words[i + 1]?.toLowerCase();
      return next === undefined || next === "and" || next === "og";
    });
    if (at > 0) name = words.slice(0, at).join(" ");
  }

  return name.replace(/\s+/g, " ").replace(/[\s,.;]+$/, "").trim();
}

// The shopping list merges on name + UNIT STRING (item_merge_key, migration
// 0013), so "2 tablespoons olive oil" and "2 tbsp olive oil" become two rows
// unless the unit is written the same way. Fold the spelled-out forms onto
// the abbreviation. Only units whose abbreviation reads correctly at any
// amount are listed – "cup"/"cups" and "clove"/"cloves" are deliberately
// absent, since "2 cup" and "1 cloves" would read wrong on the list.
const UNIT_ALIASES: Record<string, string> = {
  c: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  gram: "g",
  grams: "g",
  gr: "g",
  kilogram: "kg",
  kilograms: "kg",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  millilitres: "ml",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  ounce: "oz",
  ounces: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
};

// Sites write the same thing both ways round: "5 cloves garlic" gives unit
// "cloves" + name "garlic", while "2 garlic cloves" gives no unit and name
// "garlic cloves". Those are one ingredient and have to merge, so when the
// amount carries no unit and the name ENDS in one, move it across.
function liftTrailingUnit(
  name: string,
  amount: string,
): { name: string; quantityText: string } {
  const words = name.split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  // Never strip the only word – "2 slices" is already just a unit.
  if (words.length < 2 || !last || !UNITS.has(last)) {
    return { name, quantityText: amount };
  }
  return {
    name: words.slice(0, -1).join(" "),
    quantityText: `${amount} ${UNIT_ALIASES[last] ?? last}`,
  };
}

export function splitIngredient(text: string): {
  name: string;
  quantityText: string | null;
} {
  // "1½ tsp" means one and a half. Folding the glyph without a separator
  // would splice it onto the whole number and read as eleven halves.
  const cleaned = cleanText(text).replace(
    /(\d?)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞])/g,
    (_all, lead: string, glyph: string) =>
      (lead ? `${lead} ` : "") + (VULGAR_FRACTIONS[glyph] ?? glyph),
  );
  const match = cleaned.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/,
  );

  // No leading amount. The amount may still be trailing – "coriander leaves,
  // 1 large handful" – in which case that clause is the quantity, not a name.
  if (!match) {
    const trailing = cleaned.match(/^(.*?),\s*(\d[^,]*)$/);
    if (trailing) {
      const name = tidyIngredientName(trailing[1]);
      if (name) return { name, quantityText: trailing[2].trim() };
    }
    return { name: tidyIngredientName(cleaned) || cleaned, quantityText: null };
  }

  const amount = match[1].replace(/\s*[-–]\s*\d+(?:[.,]\d+)?$/, ""); // ranges: keep the low end
  const rest = match[2].trim();
  const firstWord =
    rest.split(/\s+/)[0]?.toLowerCase().replace(/[.,]$/, "") ?? "";
  // "2 c. à soupe" is a French TABLESPOON, not a cup – reading the bare "c"
  // as a unit there would inflate the amount ~16x. Bail out and leave the
  // whole thing in the name rather than invent a wrong quantity.
  const secondWord = rest.split(/\s+/)[1]?.toLowerCase() ?? "";
  const ambiguousC =
    firstWord === "c" && (secondWord === "à" || secondWord === "a");

  if (UNITS.has(firstWord) && !ambiguousC) {
    const unit = UNIT_ALIASES[firstWord] ?? firstWord;
    const name = tidyIngredientName(rest.slice(rest.indexOf(" ") + 1).trim());
    // "2 dl fløde" → quantity "2 dl", name "fløde"
    return name
      ? { name, quantityText: `${amount} ${unit}` }
      : { name: tidyIngredientName(rest) || rest, quantityText: amount };
  }
  const name = tidyIngredientName(rest);
  if (!name) {
    return { name: tidyIngredientName(cleaned) || cleaned, quantityText: null };
  }
  // No unit was found up front, but the name may end in one.
  return liftTrailingUnit(name, amount);
}
