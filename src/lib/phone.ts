// Dependency-free phone normalization utilities (safe for client & server).

const DEFAULT_COUNTRY_CODE = "63"; // SugboDoc is PH-based (Cebu).

/**
 * Normalizes common PH/international formats to strict E.164:
 *   "+63 917 123 4567" → "+639171234567"
 *   "0917 123 4567"    → "+639171234567"
 *   "917 123 4567"     → "+639171234567"
 *   "+1 (555) 010-2030"→ "+15550102030"
 * Returns null when the input cannot form a valid E.164 number.
 */
export function normalizeToE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    const rest = digits.slice(1);
    return /^\d{8,15}$/.test(rest) ? `+${rest}` : null;
  }

  let national = digits;
  // Strip trunk prefix ("0") for PH-style local numbers.
  if (national.startsWith("0")) national = national.slice(1);

  // Already includes a country code — keep as-is.
  if (national.startsWith(DEFAULT_COUNTRY_CODE) && national.length > 10) {
    return `+${national}`;
  }

  // Local 9-10 digit number → prepend default country code.
  if (/^\d{9,10}$/.test(national)) {
    return `+${DEFAULT_COUNTRY_CODE}${national}`;
  }

  return null;
}

/** True when the string already looks like a valid E.164 number. */
export function isE164(input: string | null | undefined): boolean {
  return typeof input === "string" && /^\+[1-9]\d{7,14}$/.test(input);
}
