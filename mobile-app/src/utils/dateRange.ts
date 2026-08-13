// Web parity (components/common/DateRangeFilter.jsx): preset date ranges and the
// { fromAt, toAt } ISO params the webhook-events / audit endpoints expect.

export interface DateRange { fromDate: string; toDate: string }

export const DATE_PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "7D", label: "7 days", days: 7 },
  { key: "30D", label: "30 days", days: 30 },
  { key: "90D", label: "90 days", days: 90 },
  { key: "ALL", label: "All", days: null },
];

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function presetDateRange(preset = "30D"): DateRange {
  if (preset === "ALL") return { fromDate: "", toDate: "" };
  const match = DATE_PRESETS.find((p) => p.key === preset) || DATE_PRESETS[1];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (match.days ?? 30));
  return { fromDate: toDateInput(start), toDate: toDateInput(today) };
}

export function dateRangeParams(range: DateRange): { fromAt?: string; toAt?: string } {
  return {
    fromAt: range.fromDate ? new Date(`${range.fromDate}T00:00:00.000`).toISOString() : undefined,
    toAt: range.toDate ? new Date(`${range.toDate}T23:59:59.999`).toISOString() : undefined,
  };
}
