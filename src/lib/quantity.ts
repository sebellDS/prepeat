// The edit sheet works with one free-text quantity field ("250g", "2 pcs",
// "a handful") while the database splits it into numeric quantity + unit
// text (projektgrundlag data model). These helpers translate between the
// two: a leading number becomes the quantity, the rest becomes the unit,
// and pure text ("a handful") is stored as unit only.

export function parseQuantity(text: string | null): {
  quantity: number | null;
  unit: string | null;
} {
  const trimmed = text?.replace(/\s+/g, ' ').trim() ?? '';
  if (!trimmed) return { quantity: null, unit: null };
  const match = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return { quantity: null, unit: trimmed };
  const quantity = Number(match[1].replace(',', '.'));
  return { quantity, unit: match[2] || null };
}

export function formatQuantity(quantity: number | null, unit: string | null): string | null {
  if (quantity == null) return unit;
  if (unit == null) return String(quantity);
  return `${quantity} ${unit}`;
}
