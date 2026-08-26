// Dependency-free safe date helpers (client & server).
//
// Guards against the classic "RangeError: Invalid time value" thrown by
// toISOString()/toLocaleDateString() when a value is undefined, null, an
// empty string, or otherwise unparsable (e.g. free-text DOB like "banana").
// Every fallback logs the offending field so recurrence is traceable.

export function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date-ish value for display. Returns `fallback` ("—" by default)
 * when the value is missing/unparseable instead of throwing or rendering
 * "Invalid Date". Logs the field label when falling back.
 */
export function safeFormatDate(
  value: unknown,
  fieldLabel?: string,
  locale = "en-PH",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = safeParseDate(value);
  if (!d) {
    if (fieldLabel && value !== null && value !== undefined && String(value).trim() !== "") {
      console.warn(`[DateUtils] Invalid date value for "${fieldLabel}":`, value);
    }
    return "—";
  }
  return d.toLocaleDateString(locale, options);
}

/** ISO string or null — never throws. Logs via the same path as safeFormatDate. */
export function safeToISOString(value: unknown, fieldLabel?: string): string | null {
  const d = safeParseDate(value);
  if (!d) {
    if (fieldLabel) {
      console.warn(`[DateUtils] Invalid date value for "${fieldLabel}":`, value);
    }
    return null;
  }
  return d.toISOString();
}

/** Date + time display ("M/D/YYYY, h:mm:ss AM"); never throws. */
export function safeFormatDateTime(value: unknown, fieldLabel?: string): string {
  const d = safeParseDate(value);
  if (!d) {
    if (fieldLabel && value !== null && value !== undefined && String(value).trim() !== "") {
      console.warn(`[DateUtils] Invalid date value for "${fieldLabel}":`, value);
    }
    return "—";
  }
  return d.toLocaleString("en-PH");
}
