// Week math for the meal plan. Weeks start on Monday (projektgrundlag) and
// are identified by their start date as a local 'YYYY-MM-DD' key – the same
// value stored in meal_plans.week_start_date. All math is done in local
// time; the plan is a family calendar, not a timezone puzzle.

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DAY_LABELS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;


const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The Monday of the week containing the given date, as a date key. */
export function weekStartOf(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  copy.setDate(copy.getDate() - sinceMonday);
  return toDateKey(copy);
}

export function addDaysKey(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function addWeeksKey(key: string, weeks: number): string {
  return addDaysKey(key, weeks * 7);
}

/** The seven date keys of a week, Monday first. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
}

/** ISO 8601 week number (the "Week 29" in the picker). */
export function isoWeekNumber(weekStart: string): number {
  // The ISO week number of a week is determined by its Thursday.
  const thursday = fromDateKey(addDaysKey(weekStart, 3));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const days = Math.round(
    (thursday.getTime() - yearStart.getTime()) / 86400000,
  );
  return Math.floor(days / 7) + 1;
}

/** "July 13-19" within one month, "Jul 27 – Aug 2" across months. */
export function weekRangeLabel(weekStart: string): string {
  const start = fromDateKey(weekStart);
  const end = fromDateKey(addDaysKey(weekStart, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()}-${end.getDate()}`;
  }
  const short = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return `${short(start)} – ${short(end)}`;
}

/** "July 13-19 · Week 29" – the picker label. */
export function weekPickerLabel(weekStart: string): string {
  return `${weekRangeLabel(weekStart)} · Week ${isoWeekNumber(weekStart)}`;
}

// (relativeWeekTitle retired 2026-07-17: the header IS the week switcher
// now – dates + week number are the anchor, no relative title.)
