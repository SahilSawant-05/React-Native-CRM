import { CalendarDays } from "lucide-react";

const PRESETS = [
  { key: "7D", label: "7D", days: 6 },
  { key: "30D", label: "30D", days: 29 },
  { key: "90D", label: "90D", days: 89 },
  { key: "ALL", label: "All", days: null },
];

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

export function presetDateRange(preset = "30D") {
  const today = new Date();
  if (preset === "ALL") return { fromDate: "", toDate: "" };
  const match = PRESETS.find((item) => item.key === preset) || PRESETS[1];
  const start = new Date(today);
  start.setDate(today.getDate() - match.days);
  return { fromDate: toDateInput(start), toDate: toDateInput(today) };
}

export function dateRangeParams({ fromDate, toDate }) {
  return {
    fromAt: fromDate ? new Date(`${fromDate}T00:00:00.000`).toISOString() : undefined,
    toAt: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined,
  };
}

export default function DateRangeFilter({ value, preset, onChange, onPresetChange, compact = false }) {
  const setPreset = (nextPreset) => {
    onPresetChange?.(nextPreset);
    onChange?.(presetDateRange(nextPreset));
  };

  const setDate = (field, nextValue) => {
    onPresetChange?.("CUSTOM");
    onChange?.({ ...value, [field]: nextValue });
  };

  return (
    <div className={`min-w-0 max-w-full rounded-lg border border-gray-200 bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800">
        <CalendarDays size={16} className="text-teal-700" />
        Date range
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              preset === item.key
                ? "bg-teal-700 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">From</span>
          <input
            type="date"
            value={value.fromDate || ""}
            onChange={(event) => setDate("fromDate", event.target.value)}
            className="block min-w-0 max-w-full rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">To</span>
          <input
            type="date"
            value={value.toDate || ""}
            onChange={(event) => setDate("toDate", event.target.value)}
            className="block min-w-0 max-w-full rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        </label>
      </div>
    </div>
  );
}
