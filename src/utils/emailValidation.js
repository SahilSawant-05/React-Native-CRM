const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function emailValidationMessage(value) {
  if (!normalizeEmail(value)) return "Please enter your email.";
  if (!isValidEmail(value)) return "Please enter a valid email address.";
  return "";
}
