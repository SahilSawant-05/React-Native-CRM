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

// Detect the device region using the built-in Intl API (available in Hermes on
// Expo SDK 54). Falls back to India when nothing conclusive is found.
export function detectRegion(): Region {
  try {
    const opts = Intl.DateTimeFormat().resolvedOptions();

    // 1) Locale region tag, e.g. "en-CA" → "CA", "en-IN" → "IN".
    const localeRegion = String(opts.locale || "").split("-")[1]?.toUpperCase();
    if (localeRegion === "CA") return "CA";
    if (localeRegion === "IN") return "IN";

    // 2) Timezone fallback — North America → Canada (.com), Asia → India (.in).
    const tz = String(opts.timeZone || "");
    if (tz.startsWith("America/")) return "CA";
    if (tz.startsWith("Asia/")) return "IN";
  } catch {
    // Intl unavailable — fall through to the default.
  }
  return "IN";
}

export const REGION: Region = detectRegion();

const DEFAULT_BASE_URL = REGION_BASE_URL[REGION];

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;

export const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_BASE_URL ?? DEFAULT_BASE_URL;
