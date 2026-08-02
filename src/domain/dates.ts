/**
 * Calendar-date helpers: formatting, relative labels, and parsing of the
 * `!datum` word forms.
 *
 * Timezone rule — keep it this way: the app works in the user's local time
 * and date fields are plain calendar dates ('YYYY-MM-DD') without a zone.
 * `toISODate`/`fromISODate` use local `getFullYear`/`getMonth`/`getDate` and
 * `new Date(y, m, d)` (local midnight). NEVER add UTC conversion here — it
 * would shift dates for users in non-zero timezone offsets.
 */

const DAY_MS = 86_400_000;

const WEEKDAY_ABBREV = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** German month name for a 0-based month index, e.g. `monthName(7) === "August"`. */
export function monthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] ?? "";
}

/** Month headline for a 0-based month index, e.g. `formatMonthYear(2026, 7) === "August 2026"`. */
export function formatMonthYear(year: number, monthIndex: number): string {
  return `${monthName(monthIndex)} ${year}`;
}

/** Converts a Date to the `YYYY-MM-DD` string stored in `date`/`due_date`/`event_date` fields. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` string into a Date at local midnight. Throws on malformed input. */
export function fromISODate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`not an ISO date: ${isoDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

/** Returns a new Date `days` days after/before `date`, preserving local time. */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Short German label, e.g. `Mo 25.8.` — weekday abbreviation + day.month. */
export function formatShort(isoDate: string): string {
  const date = fromISODate(isoDate);
  return `${WEEKDAY_ABBREV[date.getDay()]} ${date.getDate()}.${date.getMonth() + 1}.`;
}

/** German weekday abbreviation for a 0-based weekday index (0 = Sunday). */
export function weekdayShort(weekdayIndex: number): string {
  return WEEKDAY_ABBREV[weekdayIndex] ?? "";
}

/** Day of the month (1–31) of an ISO date, for the calendar day marker. */
export function dayNumber(isoDate: string): number {
  return fromISODate(isoDate).getDate();
}

/**
 * Relative German label for a date compared to `today` (local midnight):
 * heute, morgen, gestern, `3 T überfällig`, `in 3 T`.
 */
export function relativeLabel(isoDate: string, today: Date): string {
  const diff = Math.round((fromISODate(isoDate).getTime() - today.getTime()) / DAY_MS);
  if (diff === 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === -1) return "gestern";
  if (diff < 0) return `${Math.abs(diff)} T überfällig`;
  return `in ${diff} T`;
}

/**
 * Parses a single `!datum` token (without the leading `!`) into a local
 * midnight Date, or null if it is no supported form. Supported forms:
 *
 *  - `heute`, `morgen`, `übermorgen` / `uebermorgen`
 *  - weekday abbreviations `so`, `mo`, `di`, `mi`, `do`, `fr`, `sa` — the
 *    NEXT such day (1–7 days ahead, so `!mo` on a Monday means next Monday)
 *  - `D.M.` / `D.M.YY` / `D.M.YYYY` (day and month 1–2 digits, year optional;
 *    a 2-digit year means 2000+, a missing year is `today`'s year)
 */
export function parseDateWord(word: string, today: Date): Date | null {
  const token = word.toLowerCase();
  if (token === "heute") return new Date(today);
  if (token === "morgen") return addDays(today, 1);
  if (token === "übermorgen" || token === "uebermorgen") return addDays(today, 2);

  const weekdayIndex = WEEKDAY_ABBREV.findIndex((day) => day.toLowerCase() === token);
  if (weekdayIndex !== -1) {
    for (let days = 1; days < 8; days++) {
      const candidate = addDays(today, days);
      if (candidate.getDay() === weekdayIndex) return candidate;
    }
  }

  const match = /^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/.exec(token);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearToken = match[3];
    const year = yearToken ? (yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken)) : today.getFullYear();
    return new Date(year, month - 1, day);
  }

  return null;
}
