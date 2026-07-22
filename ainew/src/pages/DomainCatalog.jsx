import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import api from "../api/axios";
import useCrmSettings from "../hooks/useCrmSettings";

const FIELD_DEFINITIONS_KEY = "__fieldDefinitions";

const CATALOG_PRESETS = [
  {
    key: "REAL_ESTATE",
    label: "Property",
    nameLabel: "Property name",
    categoryLabel: "Property type",
    locationLabel: "Location",
    fields: [
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "bathrooms", label: "Bathrooms", type: "number" },
      { key: "carpetArea", label: "Carpet area", type: "number" },
      { key: "possession", label: "Possession", type: "text" },
      { key: "developer", label: "Developer", type: "text" },
    ],
  },
  {
    key: "EDUCATION",
    label: "Course",
    nameLabel: "Course name",
    categoryLabel: "Program",
    locationLabel: "Campus",
    fields: [
      { key: "duration", label: "Duration", type: "text" },
      { key: "batchDate", label: "Batch date", type: "date" },
      { key: "mode", label: "Mode", type: "select", options: "Online, Offline, Hybrid" },
      { key: "seats", label: "Seats", type: "number" },
    ],
  },
  {
    key: "BIKE_SALES",
    label: "Bike / Vehicle",
    nameLabel: "Vehicle name",
    categoryLabel: "Model",
    locationLabel: "Showroom",
    fields: [
      { key: "variant", label: "Variant", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "fuelType", label: "Fuel type", type: "select", options: "Petrol, Electric, Diesel, CNG" },
      { key: "stockStatus", label: "Stock status", type: "select", options: "In Stock, On Order, Out of Stock" },
      { key: "testRideAvailable", label: "Test ride available", type: "select", options: "Yes, No" },
    ],
  },
  {
    key: "ECOMMERCE",
    label: "Product",
    nameLabel: "Product name",
    categoryLabel: "Product category",
    locationLabel: "Warehouse / Store",
    fields: [
      { key: "sku", label: "SKU", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "warranty", label: "Warranty", type: "text" },
    ],
  },
  {
    key: "GENERIC",
    label: "Generic",
    nameLabel: "Item name",
    categoryLabel: "Category",
    locationLabel: "Location",
    fields: [],
  },
];

const emptyForm = {
  industryKey: "GENERIC",
  nameLabel: "Item name",
  categoryLabel: "Category",
  locationLabel: "Location",
  name: "",
  category: "",
  price: "",
  location: "",
  description: "",
  fieldDefinitions: [],
  metadata: {},
  active: true,
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

const normalizeKey = (value) =>
  String(value || "GENERIC")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "GENERIC";

const fieldKeyFromLabel = (value) =>
  String(value || "customField")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[^a-zA-Z]+/, "")
    .replace(/^./, (char) => char.toLowerCase()) || `field${Date.now()}`;

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
};

const parseMetadata = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const cleanMetadata = (metadata) =>
  Object.fromEntries(
    Object.entries(metadata || {}).filter(([key, value]) =>
      key !== FIELD_DEFINITIONS_KEY &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    )
  );

const cleanFieldDefinitions = (fields) =>
  (fields || [])
    .map((field) => ({
      key: normalizeFieldKey(field.key || fieldKeyFromLabel(field.label)),
      label: String(field.label || field.key || "").trim(),
      type: ["text", "number", "date", "select"].includes(field.type) ? field.type : "text",
      options: String(field.options || "").trim(),
    }))
    .filter((field) => field.key && field.label);

const normalizeFieldKey = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[^a-zA-Z]+/, "")
    .replace(/^./, (char) => char.toLowerCase());

const fieldDefinitionsFromItem = (item) => {
  const metadata = parseMetadata(item.metadataJson);
  const saved = Array.isArray(metadata[FIELD_DEFINITIONS_KEY]) ? metadata[FIELD_DEFINITIONS_KEY] : [];
  if (saved.length > 0) return cleanFieldDefinitions(saved);
  const preset = CATALOG_PRESETS.find((entry) => entry.key === item.industryKey);
  return preset?.fields || [];
};

const labelForType = (key) => {
  const preset = CATALOG_PRESETS.find((entry) => entry.key === key);
  return preset?.label || String(key || "Generic").replaceAll("_", " ");
};

export default function DomainCatalog() {
  const { activeIndustryKey } = useCrmSettings();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const errorMessage = (error, fallback) => {
    const data = error?.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.error || error.message || fallback;
  };

  const catalogTypes = useMemo(() => {
    const keys = new Set([
      ...CATALOG_PRESETS.map((preset) => preset.key),
      ...items.map((item) => item.industryKey).filter(Boolean),
      activeIndustryKey,
    ].filter(Boolean).map(normalizeKey));
    return [...keys].map((key) => ({ key, label: labelForType(key) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeIndustryKey, items]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => normalizeKey(item.industryKey) === filter);
  }, [filter, items]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/domain-items");
      setItems(normalizeList(response.data));
    } catch (error) {
      showMessage(errorMessage(error, "Failed to load catalog"), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!activeIndustryKey) return;
    const key = normalizeKey(activeIndustryKey);
    setForm((current) => current.industryKey === emptyForm.industryKey ? { ...current, industryKey: key } : current);
  }, [activeIndustryKey]);

  const setValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setMetadataValue = (field, value) => {
    setForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [field]: value,
      },
    }));
  };

  const setFieldDefinition = (index, field, value) => {
    setForm((current) => ({
      ...current,
      fieldDefinitions: current.fieldDefinitions.map((definition, currentIndex) => {
        if (currentIndex !== index) return definition;
        const next = { ...definition, [field]: value };
        if (field === "label" && (!definition.key || definition.key.startsWith("field"))) {
          next.key = normalizeFieldKey(fieldKeyFromLabel(value));
        }
        return next;
      }),
    }));
  };

  const addField = () => {
    setForm((current) => ({
      ...current,
      fieldDefinitions: [
        ...current.fieldDefinitions,
        { key: `field${current.fieldDefinitions.length + 1}`, label: "", type: "text", options: "" },
      ],
    }));
  };

  const removeField = (index) => {
    setForm((current) => {
      const removed = current.fieldDefinitions[index];
      const nextMetadata = { ...current.metadata };
      if (removed?.key) delete nextMetadata[removed.key];
      return {
        ...current,
        fieldDefinitions: current.fieldDefinitions.filter((_, currentIndex) => currentIndex !== index),
        metadata: nextMetadata,
      };
    });
  };

  const applyPreset = (preset) => {
    setForm((current) => ({
      ...current,
      industryKey: preset.key,
      nameLabel: preset.nameLabel,
      categoryLabel: preset.categoryLabel,
      locationLabel: preset.locationLabel,
      fieldDefinitions: preset.fields,
      metadata: {},
    }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm, industryKey: normalizeKey(activeIndustryKey || "GENERIC"), metadata: {}, fieldDefinitions: [] });
    setEditingId(null);
    showMessage("", "info");
  };

  const saveItem = async (event) => {
    event.preventDefault();
    const normalizedCatalogType = normalizeKey(form.industryKey);
    const invalidField = form.fieldDefinitions.find((field) => {
      const hasAnyValue = Boolean(String(field.label || field.key || field.options || "").trim());
      return hasAnyValue && (!String(field.label || "").trim() || !normalizeFieldKey(field.key || fieldKeyFromLabel(field.label)));
    });
    const duplicateKeys = cleanFieldDefinitions(form.fieldDefinitions)
      .map((field) => field.key)
      .filter((key, index, keys) => keys.indexOf(key) !== index);

    if (!normalizedCatalogType) {
      showMessage("Catalog Type Key is required.", "error");
      return;
    }
    if (!form.name.trim()) {
      showMessage(`${form.nameLabel || "Item name"} is required before adding a catalog item.`, "error");
      return;
    }
    if (form.price !== "" && Number.isNaN(Number(form.price))) {
      showMessage("Price / Value must be a valid number.", "error");
      return;
    }
    if (invalidField) {
      showMessage("Each custom field needs a field label and field key, or remove the empty field.", "error");
      return;
    }
    if (duplicateKeys.length > 0) {
      showMessage(`Custom field keys must be unique. Duplicate key: ${duplicateKeys[0]}`, "error");
      return;
    }

    const fieldDefinitions = cleanFieldDefinitions(form.fieldDefinitions);
    const metadata = cleanMetadata(form.metadata);
    const metadataJson = JSON.stringify({
      ...metadata,
      [FIELD_DEFINITIONS_KEY]: fieldDefinitions,
    });

    setSaving(true);
    setMessage("");
    const payload = {
      industryKey: normalizedCatalogType,
      name: form.name.trim(),
      category: form.category.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      metadataJson,
      active: form.active,
    };

    try {
      let savedItem;
      if (editingId) {
        const response = await api.put(`/api/domain-items/${editingId}`, payload);
        savedItem = response.data;
        showMessage("Catalog item updated.", "success");
      } else {
        const response = await api.post("/api/domain-items", payload);
        savedItem = response.data;
        showMessage("Catalog item added.", "success");
      }
      if (savedItem?.id) {
        setItems((current) => {
          const withoutSaved = current.filter((item) => item.id !== savedItem.id);
          return [savedItem, ...withoutSaved];
        });
      }
      setFilter("ALL");
      resetForm();
      await loadItems();
    } catch (error) {
      showMessage(errorMessage(error, "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const editItem = (item) => {
    const metadata = parseMetadata(item.metadataJson);
    const preset = CATALOG_PRESETS.find((entry) => entry.key === item.industryKey);
    setEditingId(item.id);
    setForm({
      industryKey: item.industryKey || "GENERIC",
      nameLabel: preset?.nameLabel || "Item name",
      categoryLabel: preset?.categoryLabel || "Category",
      locationLabel: preset?.locationLabel || "Location",
      name: item.name || "",
      category: item.category || "",
      price: item.price ?? "",
      location: item.location || "",
      description: item.description || "",
      fieldDefinitions: fieldDefinitionsFromItem(item),
      metadata: cleanMetadata(metadata),
      active: item.active !== false,
    });
    setFilter("ALL");
    showMessage(`Editing "${item.name}". Update the form and save changes.`, "info");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete catalog item "${item.name}"?`)) return;
    setMessage("");
    setDeletingId(item.id);
    try {
      await api.delete(`/api/domain-items/${item.id}`);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingId === item.id) {
        resetForm();
      }
      showMessage("Catalog item deleted.", "success");
      await loadItems();
    } catch (error) {
      showMessage(errorMessage(error, "Delete failed"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-gray-900 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-950">Catalog</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create any catalog type your CRM needs: property, product, course, car, bike, insurance plan, or a custom item.
            </p>
          </div>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500"
          >
            <option value="ALL">All catalog types</option>
            {catalogTypes.map((type) => (
              <option key={type.key} value={type.key}>{type.label}</option>
            ))}
          </select>
        </header>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <form onSubmit={saveItem} className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-950">{editingId ? "Edit Catalog Item" : "Add Catalog Item"}</h2>
                <p className="mt-1 text-sm text-gray-500">Use a preset or define fields manually.</p>
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  Cancel
                </button>
              )}
            </div>

            <div className="mb-5 grid min-w-0 gap-2 sm:grid-cols-2">
              {CATALOG_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                    form.industryKey === preset.key
                      ? "border-teal-300 bg-teal-50 text-teal-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Catalog Type Key</label>
                <input
                  value={form.industryKey}
                  onChange={(event) => setValue("industryKey", normalizeKey(event.target.value))}
                  placeholder="ECOMMERCE / CAR_SALES / REAL_ESTATE"
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <p className="mt-1 text-xs text-gray-400">Use the same key as the pipeline type when you want opportunities to map to these items.</p>
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Name Label</label>
                  <input value={form.nameLabel} onChange={(event) => setValue("nameLabel", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Category Label</label>
                  <input value={form.categoryLabel} onChange={(event) => setValue("categoryLabel", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Location Label</label>
                  <input value={form.locationLabel} onChange={(event) => setValue("locationLabel", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{form.nameLabel || "Item name"}</label>
                <input
                  value={form.name}
                  onChange={(event) => setValue("name", event.target.value)}
                  className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{form.categoryLabel || "Category"}</label>
                  <input value={form.category} onChange={(event) => setValue("category", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Price / Value</label>
                  <input type="number" value={form.price} onChange={(event) => setValue("price", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{form.locationLabel || "Location"}</label>
                <input value={form.location} onChange={(event) => setValue("location", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Description</label>
                <textarea rows={4} value={form.description} onChange={(event) => setValue("description", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-gray-950">Custom Fields</h3>
                  <button type="button" onClick={addField} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    <Plus size={14} />
                    Add Field
                  </button>
                </div>

                <div className="space-y-3">
                  {form.fieldDefinitions.map((field, index) => {
                    const normalizedKey = normalizeFieldKey(field.key || fieldKeyFromLabel(field.label));
                    const options = String(field.options || "").split(",").map((option) => option.trim()).filter(Boolean);
                    return (
                      <div key={`${field.key}-${index}`} className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(96px,110px)_auto]">
                          <input value={field.label} onChange={(event) => setFieldDefinition(index, "label", event.target.value)} placeholder="Field label" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          <input value={field.key} onChange={(event) => setFieldDefinition(index, "key", normalizeFieldKey(event.target.value))} placeholder="fieldKey" className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          <select value={field.type} onChange={(event) => setFieldDefinition(index, "type", event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="select">Select</option>
                          </select>
                          <button type="button" onClick={() => removeField(index)} className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50">
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {field.type === "select" && (
                          <input value={field.options || ""} onChange={(event) => setFieldDefinition(index, "options", event.target.value)} placeholder="Options separated by comma" className="mt-2 w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                        )}
                        {field.label && normalizedKey && (
                          <div className="mt-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{field.label}</label>
                            {field.type === "select" ? (
                              <select value={form.metadata?.[normalizedKey] || ""} onChange={(event) => setMetadataValue(normalizedKey, event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                                <option value="">Select</option>
                                {options.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            ) : (
                              <input type={field.type || "text"} value={form.metadata?.[normalizedKey] || ""} onChange={(event) => setMetadataValue(normalizedKey, event.target.value)} className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {form.fieldDefinitions.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                      No custom fields yet. Add fields like SKU, bedrooms, batch date, engine type, or warranty.
                    </div>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.active} onChange={(event) => setValue("active", event.target.checked)} />
                Active
              </label>
            </div>

            <button type="submit" disabled={saving} className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update Item" : "Add Item"}
            </button>
            {message && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                messageType === "error"
                  ? "bg-red-50 text-red-700"
                  : messageType === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-50 text-gray-600"
              }`}>
                {message}
              </p>
            )}
          </form>

          <section className="min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-950">Catalog Items</h2>
              <p className="text-sm text-gray-500">
                {loading ? "Loading..." : `${visibleItems.length} visible${filter !== "ALL" ? ` of ${items.length} total` : ""}`}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {visibleItems.map((item) => {
                const metadata = parseMetadata(item.metadataJson);
                const definitions = fieldDefinitionsFromItem(item);
                const labels = new Map(definitions.map((field) => [field.key, field.label]));
                const metadataEntries = Object.entries(cleanMetadata(metadata));
                return (
                  <article key={item.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-950">{item.name}</h3>
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">{labelForType(item.industryKey)}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{item.industryKey}</span>
                        {editingId === item.id && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Editing</span>}
                        {item.active === false && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Inactive</span>}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {[item.category, item.location, formatMoney(item.price)].filter(Boolean).join(" - ")}
                      </p>
                      {metadataEntries.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {metadataEntries.slice(0, 8).map(([key, value]) => (
                            <span key={key} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                              {labels.get(key) || key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.description && <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => editItem(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {visibleItems.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-gray-500">
                  {items.length > 0
                    ? "No catalog items match the selected catalog type filter."
                    : "No catalog items yet."}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
