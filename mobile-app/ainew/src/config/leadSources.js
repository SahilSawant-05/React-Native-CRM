export const LEAD_SOURCE_OPTIONS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "WEBSITE_FORM", label: "Website Form" },
  { value: "WEBSITE", label: "Website" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PORTAL", label: "Portal" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "CSV_IMPORT", label: "CSV / Excel Import" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTHER", label: "Other" },
];

export const LEAD_SOURCE_VALUES = LEAD_SOURCE_OPTIONS.map((option) => option.value);

const SOURCE_LABELS = new Map([
  ...LEAD_SOURCE_OPTIONS.map((option) => [option.value, option.label]),
  ["IMPORT", "CSV / Excel Import"],
  ["CSV", "CSV / Excel Import"],
  ["UPLOAD", "CSV / Excel Import"],
  ["WEB", "Website"],
]);

export function leadSourceLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return SOURCE_LABELS.get(normalized) || normalized.replaceAll("_", " ");
}
