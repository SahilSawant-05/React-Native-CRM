export function StatusBanner({ error, success }) {
  if (!error && !success) return null;

  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error || success}
    </div>
  );
}

export function SettingsTabs({ activeTab, items, onChange }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
      {items.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
              active
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldLabel({ children }) {
  return <label className="mb-1 block text-sm font-medium text-gray-700">{children}</label>;
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
        props.className || ""
      }`}
    />
  );
}

export function SelectInput(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
        props.className || ""
      }`}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
        props.className || ""
      }`}
    />
  );
}

export function PrimaryButton({ children, icon: Icon, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, icon: Icon, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
