// The edit sheets work with one free-text quantity field ("250g", "2 pcs",
// "1/2 tsp", "a handful") while the database splits it into numeric quantity
// + unit text (projektgrundlag data model). These helpers translate between
// the two: a leading number becomes the quantity, the rest becomes the unit,
// and pure text ("a handful") is stored as unit only. Decimal commas ("1,5")
// and simple or mixed fractions ("1/2", "1 1/2") all parse – real cooking
// amounts survive (recipes decision, 2026-07-12).

export function parseQuantity(text: string | null): {
  quantity: number | null;
  unit: string | null;
} {
  const trimmed = text?.replace(/\s+/g, ' ').trim() ?? '';
  if (!trimmed) return { quantity: null, unit: null };

  // Mixed fraction first ("1 1/2 dl"), then plain fraction ("1/2 tsp"),
  // then decimal with dot or comma ("1,5 kg", "250g").
  const mixed = trimmed.match(/^(\d+) (\d+)\/(\d+)\s*(.*)$/);
  if (mixed) {
    const [, whole, num, den, unit] = mixed;
    if (Number(den) !== 0) {
      return { quantity: Number(whole) + Number(num) / Number(den), unit: unit || null };
    }
  }
  const fraction = trimmed.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fraction) {
    const [, num, den, unit] = fraction;
    if (Number(den) !== 0) {
      return { quantity: Number(num) / Number(den), unit: unit || null };
    }
  }
  const decimal = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (decimal) {
    return { quantity: Number(decimal[1].replace(',', '.')), unit: decimal[2] || null };
  }
  return { quantity: null, unit: trimmed };
}

/** Rounds a (possibly scaled) amount to at most two sensible decimals. */
export function roundQuantity(quantity: number): number {
  return Math.round(quantity * 100) / 100;
}

// Count units that read wrong at "1" – "1 cups" should be "1 cup". An explicit
// map, not a blanket "drop trailing s", so Danish units that end in s or r
// (glas, ris, liter) and imperial abbreviations (oz) are never mangled. Weight
// and volume units (g, ml, tbsp) have no plural to fix.
//
// This is the DISPLAY half of the same job migration 0027 does for identity in
// norm_item_unit (the shopping list's merge key). The two lists are kept in the
// same shape on purpose, but they are not the same list and neither generates
// the other: this one turns a plural into a readable singular, while the SQL
// one folds both forms onto a key nobody ever sees. Add to both when a unit
// turns up missing.
const UNIT_SINGULARS: Record<string, string> = {
  cups: 'cup',
  cloves: 'clove',
  slices: 'slice',
  sprigs: 'sprig',
  heads: 'head',
  cans: 'can',
  pieces: 'piece',
  sticks: 'stick',
  pinches: 'pinch',
  bunches: 'bunch',
  handfuls: 'handful',
  sheets: 'sheet',
  tablespoons: 'tablespoon',
  teaspoons: 'teaspoon',
  // Singulars ending in r – the shape that broke the merge key in 0024 and
  // reads wrong here for the same reason. An imported recipe stores "l"
  // instead (the importer's UNIT_ALIASES), so these only show up on an item
  // typed by hand as "2 liters milk" and later scaled down to 1.
  liters: 'liter',
  litres: 'litre',
  jars: 'jar',
  containers: 'container',
  // Remaining English plurals a recipe actually uses.
  bags: 'bag',
  packs: 'pack',
  boxes: 'box',
  dashes: 'dash',
  glasses: 'glass',
  // Danish, because the app's UI language is English but its recipes are not:
  // an import from a Danish site stores "dåser", and Danish takes the singular
  // after 1 exactly as English does.
  dåser: 'dåse',
  pakker: 'pakke',
  kopper: 'kop',
  skiver: 'skive',
  poser: 'pose',
  plader: 'plade',
  stykker: 'stykke',
  bundter: 'bundt',
  bægre: 'bæger',
  håndfulde: 'håndfuld',
};

export function formatQuantity(quantity: number | null, unit: string | null): string | null {
  if (quantity == null) return unit;
  const amount = roundQuantity(quantity);
  if (unit == null) return String(amount);
  const shown = amount === 1 ? (UNIT_SINGULARS[unit.toLowerCase()] ?? unit) : unit;
  return `${amount} ${shown}`;
}
