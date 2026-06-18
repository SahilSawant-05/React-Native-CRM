function parseOptions(optionsJson) {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return optionsJson
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function inputBaseClass() {
  return "border border-gray-200 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:border-teal-400 bg-white";
}

export default function CustomFieldInputs({ fields = [], values = {}, onChange }) {
  const activeFields = fields
    .filter((field) => field.active !== false)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100));

  if (activeFields.length === 0) return null;

  const setValue = (fieldKey, value) => {
    onChange?.({ ...values, [fieldKey]: value });
  };

  return (
    <div className="mt-1 border-t border-gray-100 pt-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Industry Fields
      </p>
      <div className="grid gap-3">
        {activeFields.map((field) => {
          const fieldKey = field.fieldKey;
          const value = values[fieldKey] ?? "";
          const label = `${field.label}${field.required ? " *" : ""}`;
          const type = field.type || "TEXT";

          if (type === "DROPDOWN") {
            const options = parseOptions(field.optionsJson);
            return (
              <div key={field.id || fieldKey}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
                <select
                  value={value}
                  onChange={(event) => setValue(fieldKey, event.target.value)}
                  className={inputBaseClass()}
                >
                  <option value="">Select {field.label}</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (type === "BOOLEAN") {
            return (
              <label
                key={field.id || fieldKey}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={value === "true" || value === true}
                  onChange={(event) => setValue(fieldKey, event.target.checked ? "true" : "false")}
                />
                {label}
              </label>
            );
          }

          const inputType =
            type === "NUMBER" ? "number" : type === "DATE" ? "date" : "text";

          return (
            <div key={field.id || fieldKey}>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
              <input
                type={inputType}
                value={value}
                onChange={(event) => setValue(fieldKey, event.target.value)}
                placeholder={field.label}
                className={inputBaseClass()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
