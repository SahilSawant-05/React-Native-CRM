const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return !email || EMAIL_PATTERN.test(email);
}

export function normalizePhoneWithCountryCode(value, countryCode = "91") {
  const code = String(countryCode || "").replace(/\D/g, "") || "91";
  const digits = sanitizeLocalPhone(value, code);
  if (!digits) return "";
  if (digits.length !== 10) {
    throw new Error("Please enter exactly 10 digits in the phone number field.");
  }
  return `${code}${digits}`;
}

export function sanitizeLocalPhone(value, countryCode = "91") {
  let digits = String(value || "").replace(/\D/g, "");
  const code = String(countryCode || "").replace(/\D/g, "") || "91";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(code) && digits.length > 10) {
    digits = digits.slice(code.length);
  }
  if (digits.startsWith("0") && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function validateContactMethods({ email, phone, countryCode = "91" }) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  try {
    const normalizedPhone = normalizePhoneWithCountryCode(phone, countryCode);
    if (!normalizedPhone && !normalizedEmail) {
      return { ok: false, message: "Please enter at least phone or email." };
    }
    return { ok: true, email: normalizedEmail, phone: normalizedPhone };
  } catch (error) {
    return { ok: false, message: error.message || "Please enter a valid phone number." };
  }
}

export function isInternalPhonePlaceholder(value) {
  const text = String(value || "");
  return text.startsWith("EMAIL-") || text.startsWith("WEB-");
}
