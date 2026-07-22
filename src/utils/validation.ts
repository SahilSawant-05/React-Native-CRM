// Contact field validation — mirrors the web app so mobile-created contacts
// pass the same checks (ainew/src/utils/emailValidation.js + the country-code
// phone model used in AddContact.jsx).

// Same pattern the web uses: something@something.tld (tld ≥ 2 chars), no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value?: string | null): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

/** Returns "" when valid (or empty & optional), else a user-facing message. */
export function emailValidationMessage(value?: string | null, required = false): string {
  const normalized = normalizeEmail(value);
  if (!normalized) return required ? "Please enter an email address." : "";
  if (!isValidEmail(normalized)) return "Please enter a valid email address.";
  return "";
}

/** Strips everything except digits (drops +, spaces, dashes, parentheses). */
export function phoneDigits(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

// National number length excluding country code. India is 10; keep a tolerant
// 6–14 window so other countries (US 10, UK/AE variable, SG 8, …) also pass.
const MIN_PHONE_DIGITS = 6;
const MAX_PHONE_DIGITS = 14;

export function isValidPhone(value?: string | null): boolean {
  const digits = phoneDigits(value);
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

/** Returns "" when valid (or empty & optional), else a user-facing message. */
export function phoneValidationMessage(value?: string | null, required = false): string {
  const digits = phoneDigits(value);
  if (!digits) return required ? "Please enter a phone number." : "";
  if (/[a-zA-Z]/.test(String(value || ""))) return "Phone number can only contain digits.";
  if (digits.length < MIN_PHONE_DIGITS) return `Phone number is too short (min ${MIN_PHONE_DIGITS} digits).`;
  if (digits.length > MAX_PHONE_DIGITS) return `Phone number is too long (max ${MAX_PHONE_DIGITS} digits).`;
  return "";
}
