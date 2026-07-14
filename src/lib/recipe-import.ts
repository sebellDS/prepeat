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
    cookMinutes:
      parseIsoDuration(asString(node.cookTime)) ??
      parseIsoDuration(asString(node.totalTime)),
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
    cookMinutes: timeOf("cookTime") ?? timeOf("totalTime"),
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

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&aring;/g, "å")
    .replace(/&oslash;/g, "ø")
    .replace(/&aelig;/g, "æ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Ingredient strings → name + quantity ─────────────────────────────────
// Site strings are quantity-first ("400 g cherry tomatoes", "2 fed
// hvidløg", "1/2 tsp salt"). We split a leading amount and an optional
// known unit; the rest is the name. Unknown middle words stay in the name
// ("1 stort løg" → 1 + "stort løg").

const UNITS = new Set([
  // metric + Danish
  "g",
  "gram",
  "kg",
  "mg",
  "ml",
  "cl",
  "dl",
  "l",
  "liter",
  "litre",
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

export function splitIngredient(text: string): {
  name: string;
  quantityText: string | null;
} {
  const cleaned = cleanText(text);
  const match = cleaned.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(.*)$/,
  );
  if (!match) return { name: cleaned, quantityText: null };
  const amount = match[1].replace(/\s*[-–]\s*\d+(?:[.,]\d+)?$/, ""); // ranges: keep the low end
  const rest = match[2].trim();
  const firstWord =
    rest.split(/\s+/)[0]?.toLowerCase().replace(/[.,]$/, "") ?? "";
  if (UNITS.has(firstWord)) {
    const name = rest.slice(rest.indexOf(" ") + 1).trim();
    // "2 dl fløde" → quantity "2 dl", name "fløde"
    return name
      ? { name, quantityText: `${amount} ${firstWord}` }
      : { name: rest, quantityText: amount };
  }
  return rest
    ? { name: rest, quantityText: amount }
    : { name: cleaned, quantityText: null };
}
