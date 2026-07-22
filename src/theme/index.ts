import { Platform } from "react-native";

/**
 * Native-first design tokens.
 *
 * Fonts: use the real platform system fonts with proper weights.
 * iOS renders SF Pro automatically; Android needs explicit
 * "sans-serif-medium" for a true medium weight (fontWeight alone
 * synthesises it and looks web-ish on some OEM skins).
 */
export const fonts = {
  regular: Platform.select({ ios: undefined, android: "sans-serif" }),
  medium: Platform.select({ ios: undefined, android: "sans-serif-medium" }),
  // On iOS fontWeight handles weight; on Android pair family + weight
};

export const type = {
  /** Large screen title, e.g. "Messages" */
  largeTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: Platform.OS === "ios" ? 0.36 : 0,
    fontFamily: fonts.medium,
    color: "#111827",
  },
  /** Section / card title */
  title: {
    fontSize: 17,
    fontWeight: "600" as const,
    letterSpacing: Platform.OS === "ios" ? -0.4 : 0,
    fontFamily: fonts.medium,
    color: "#111827",
  },
  /** Primary row text (contact name etc.) */
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: fonts.regular,
    color: "#111827",
    lineHeight: 21,
  },
  /** Secondary text (previews, subtitles) */
  subhead: {
    fontSize: 14,
    fontWeight: "400" as const,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
    fontFamily: fonts.regular,
    color: "#6b7280",
    lineHeight: 19,
  },
  /** Timestamps, badges, fine print */
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    letterSpacing: 0,
    fontFamily: fonts.regular,
    color: "#9ca3af",
  },
};

export const colors = {
  // Brand
  primary: "#0f766e",
  primaryDark: "#115e59",
  primarySoft: "#f0fdfa",

  // Surfaces
  background: "#f8f9fb",
  surface: "#ffffff",
  chatWallpaper: "#eef2f5",

  // Text
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",

  // Lines
  separator: "rgba(60,60,67,0.12)",
  separatorSoft: "rgba(60,60,67,0.06)",

  // Semantic
  danger: "#dc2626",
  success: "#16a34a",
  unreadBadge: "#0f766e",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
};
