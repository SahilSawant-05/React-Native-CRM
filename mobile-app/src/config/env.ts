// Region-based backend endpoint selection.
//   • India  → https://api.vistaarflow.in
//   • Canada → https://api.vistaarflow.com
// The region is auto-detected from the device's locale/timezone (no user
// action). An explicit EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_WS_BASE_URL env
// var always wins (used for testing against a specific backend).

export type Region = "IN" | "CA";

const REGION_BASE_URL: Record<Region, string> = {
  IN: "https://api.vistaarflow.in",
  CA: "https://api.vistaarflow.com",
};

// The country the app treats as the default when the device country is neither
// India nor Canada (or can't be read).
const DEFAULT_REGION: Region = "IN";

// Canadian IANA timezones — used only as a fallback when the device country
// code isn't available from the locale.
const CA_TIMEZONES = [
  "America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg",
  "America/Halifax", "America/Regina", "America/St_Johns", "America/Moncton",
];

// Detect the device COUNTRY using the built-in Intl API (available in Hermes on
// Expo SDK 54). This reflects where the user/device is set up — the practical
// stand-in for "where the app was downloaded", which the OS does not expose.
export function detectRegion(): Region {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();

    // 1) Country from the device locale, e.g. "en-CA" → "CA", "en-IN" → "IN".
    const country = String(opts.locale || "").split("-")[1]?.toUpperCase();
    if (country === "CA") return "CA";
    if (country === "IN") return "IN";
    // Any other explicit country → default (they aren't IN or CA users).
    if (country) return DEFAULT_REGION;

    // 2) Timezone fallback only when no country tag is present.
    const tz = String(opts.timeZone || "");
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "IN";
    if (CA_TIMEZONES.includes(tz)) return "CA";
  } catch {
    // Intl unavailable — fall through to the default.
  }
  return DEFAULT_REGION;
}

export const REGION: Region = detectRegion();

const DEFAULT_BASE_URL = REGION_BASE_URL[REGION];

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;

export const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_BASE_URL ?? DEFAULT_BASE_URL;
