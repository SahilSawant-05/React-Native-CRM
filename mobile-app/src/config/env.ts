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

// Detect the device region using the built-in Intl API (available in Hermes on
// Expo SDK 54). The TIMEZONE is the primary signal because it reflects where
// the device physically is — the locale often stays "en-US" regardless of
// country, so it's only a weak secondary hint. This is the practical stand-in
// for "where the app was downloaded", which the OS does not expose.
export function detectRegion(): Region {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();

    // 1) Timezone (reliable for physical location).
    const tz = String(opts.timeZone || "");
    if (CA_TIMEZONES.includes(tz)) return "CA";
    if (tz.startsWith("America/")) return "CA";   // North America → Canada (.com)
    if (tz.startsWith("Asia/")) return "IN";      // Asia (incl. Asia/Calcutta) → India (.in)

    // 2) Locale country as a weak fallback only when timezone was unhelpful.
    const country = String(opts.locale || "").split("-")[1]?.toUpperCase();
    if (country === "CA") return "CA";
    if (country === "IN") return "IN";
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
