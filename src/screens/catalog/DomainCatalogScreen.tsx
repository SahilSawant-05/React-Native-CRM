import React, { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// Mobile port of the web Catalog (ainew DomainCatalog.jsx): CRUD catalog
// items with industry presets (Property / Course / Bike / Product / Generic),
// per-type field labels, and custom fields stored inside metadataJson under
// the __fieldDefinitions key — same storage format as web.

const FIELD_DEFINITIONS_KEY = "__fieldDefinitions";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string;
}

interface CatalogPreset {
  key: string;
  label: string;
  nameLabel: string;
  categoryLabel: string;
  locationLabel: string;
  fields: FieldDef[];
}

const CATALOG_PRESETS: CatalogPreset[] = [
  {
    key: "REAL_ESTATE", label: "Property",
    nameLabel: "Property name", categoryLabel: "Property type", locationLabel: "Location",
    fields: [
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "bathrooms", label: "Bathrooms", type: "number" },
      { key: "carpetArea", label: "Carpet area", type: "number" },
      { key: "possession", label: "Possession", type: "text" },
      { key: "developer", label: "Developer", type: "text" },
    ],
  },
  {
    key: "EDUCATION", label: "Course",
    nameLabel: "Course name", categoryLabel: "Program", locationLabel: "Campus",
    fields: [
      { key: "duration", label: "Duration", type: "text" },
      { key: "batchDate", label: "Batch date", type: "date" },
      { key: "mode", label: "Mode", type: "select", options: "Online, Offline, Hybrid" },
      { key: "seats", label: "Seats", type: "number" },
    ],
  },
  {
    key: "BIKE_SALES", label: "Bike / Vehicle",
    nameLabel: "Vehicle name", categoryLabel: "Model", locationLabel: "Showroom",
    fields: [
      { key: "variant", label: "Variant", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "fuelType", label: "Fuel type", type: "select", options: "Petrol, Electric, Diesel, CNG" },
      { key: "stockStatus", label: "Stock status", type: "select", options: "In Stock, On Order, Out of Stock" },
      { key: "testRideAvailable", label: "Test ride available", type: "select", options: "Yes, No" },
    ],
  },
  {
    key: "ECOMMERCE", label: "Product",
    nameLabel: "Product name", categoryLabel: "Product category", locationLabel: "Warehouse / Store",
    fields: [
      { key: "sku", label: "SKU", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "warranty", label: "Warranty", type: "text" },
    ],
  },
  {
    key: "GENERIC", label: "Generic",
    nameLabel: "Item name", categoryLabel: "Category", locationLabel: "Location",
    fields: [],
  },
];

interface DomainItem {
  id: number | string;
  industryKey?: string;
  name: string;
  category?: string | null;
  price?: number | null;
  location?: string | null;
  description?: string | null;
  metadataJson?: string | null;
  active?: boolean;
}

// ─── Helpers (web parity) ─────────────────────────────────────────────────────

const normalizeList = (payload: any): DomainItem[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  return [];
};

const normalizeKey = (value: any): string =>
  String(value || "GENERIC").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "GENERIC";

const labelForType = (key?: string): string => {
  const preset = CATALOG_PRESETS.find((entry) => entry.key === key);
  return preset?.label || String(key || "Generic").replaceAll("_", " ");
};

const presetForKey = (key?: string): CatalogPreset =>
  CATALOG_PRESETS.find((entry) => entry.key === normalizeKey(key)) || CATALOG_PRESETS[CATALOG_PRESETS.length - 1];

const parseMetadata = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const cleanMetadata = (metadata: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(metadata || {}).filter(([key, value]) =>
      key !== FIELD_DEFINITIONS_KEY && value !== null && value !== undefined && String(value).trim() !== ""
    )
  );

const fieldDefinitionsFromItem = (item: DomainItem): FieldDef[] => {
  const metadata = parseMetadata(item.metadataJson);
  const saved = Array.isArray(metadata[FIELD_DEFINITIONS_KEY]) ? metadata[FIELD_DEFINITIONS_KEY] : [];
  if (saved.length > 0) return saved as FieldDef[];
  return presetForKey(item.industryKey).fields;
};

const formatMoney = (value: any): string => {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(number);
};

// ─── Item form (modal) ────────────────────────────────────────────────────────

interface FormState {
  industryKey: string;
  name: string;
  category: string;
  price: string;
  location: string;
  description: string;
  fieldDefinitions: FieldDef[];
  metadata: Record<string, any>;
  active: boolean;
}

const blankForm = (industryKey = "GENERIC"): FormState => ({
  industryKey,
  name: "", category: "", price: "", location: "", description: "",
  fieldDefinitions: presetForKey(industryKey).fields,
  metadata: {},
  active: true,
});

function ItemFormModal({
  visible, editing, onClose, onSaved,
}: {
  visible: boolean;
  editing: DomainItem | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (!visible) return;
    setError("");
    if (editing) {
      setForm({
        industryKey: normalizeKey(editing.industryKey),
        name: editing.name || "",
        category: editing.category || "",
        price: editing.price != null ? String(editing.price) : "",
        location: editing.location || "",
        description: editing.description || "",
        fieldDefinitions: fieldDefinitionsFromItem(editing),
        metadata: cleanMetadata(parseMetadata(editing.metadataJson)),
        active: editing.active !== false,
      });
    } else {
      setForm(blankForm());
    }
  }, [visible, editing]);

  const preset = presetForKey(form.industryKey);

  const set = (field: keyof FormState, value: any) => setForm((cur) => ({ ...cur, [field]: value }));
  const setMeta = (key: string, value: string) =>
    setForm((cur) => ({ ...cur, metadata: { ...cur.metadata, [key]: value } }));

  function applyPreset(p: CatalogPreset) {
    setForm((cur) => ({
      ...cur,
      industryKey: p.key,
      fieldDefinitions: p.fields,
      metadata: {},
    }));
  }

  async function save() {
    if (saving) return;
    if (!form.name.trim()) { setError(`${preset.nameLabel} is required.`); return; }
    if (form.price !== "" && Number.isNaN(Number(form.price))) { setError("Price / Value must be a valid number."); return; }
    setSaving(true);
    setError("");
    // Same storage format as web: values + field definitions in metadataJson
    const metadataJson = JSON.stringify({
      ...cleanMetadata(form.metadata),
      [FIELD_DEFINITIONS_KEY]: form.fieldDefinitions,
    });
    const payload = {
      industryKey: normalizeKey(form.industryKey),
      name: form.name.trim(),
      category: form.category.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      metadataJson,
      active: form.active,
    };
    try {
      if (editing?.id != null) {
        await api.put(`/api/domain-items/${editing.id}`, payload);
        onSaved("Catalog item updated.");
      } else {
        await api.post("/api/domain-items", payload);
        onSaved("Catalog item added.");
      }
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>{editing ? "Edit Catalog Item" : "Add Catalog Item"}</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            {!!error && <View style={s.errorBox}><Text style={s.errorBoxText}>{error}</Text></View>}

            <Text style={s.fieldLabel}>Catalog type</Text>
            <View style={s.chipWrap}>
              {CATALOG_PRESETS.map((p) => {
                const active = form.industryKey === p.key;
                return (
                  <TouchableOpacity key={p.key} style={[s.chip, active && s.chipActive]} onPress={() => applyPreset(p)}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>{preset.nameLabel} *</Text>
            <TextInput style={s.input} value={form.name} onChangeText={(v) => set("name", v)} placeholder={preset.nameLabel} placeholderTextColor="#9ca3af" />

            <Text style={s.fieldLabel}>{preset.categoryLabel}</Text>
            <TextInput style={s.input} value={form.category} onChangeText={(v) => set("category", v)} placeholder={preset.categoryLabel} placeholderTextColor="#9ca3af" />

            <Text style={s.fieldLabel}>Price / Value (₹)</Text>
            <TextInput style={s.input} value={form.price} onChangeText={(v) => set("price", v)} placeholder="e.g. 2500000" placeholderTextColor="#9ca3af" keyboardType="numeric" />

            <Text style={s.fieldLabel}>{preset.locationLabel}</Text>
            <TextInput style={s.input} value={form.location} onChangeText={(v) => set("location", v)} placeholder={preset.locationLabel} placeholderTextColor="#9ca3af" />

            <Text style={s.fieldLabel}>Description</Text>
            <TextInput
              style={[s.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={form.description}
              onChangeText={(v) => set("description", v)}
              placeholder="Short description shown to agents"
              placeholderTextColor="#9ca3af"
              multiline
            />

            {form.fieldDefinitions.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Details ({labelForType(form.industryKey)} fields)</Text>
                {form.fieldDefinitions.map((field) => {
                  const value = form.metadata[field.key] != null ? String(form.metadata[field.key]) : "";
                  if (field.type === "select") {
                    const options = String(field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
                    return (
                      <View key={field.key}>
                        <Text style={s.fieldLabel}>{field.label}</Text>
                        <View style={s.chipWrap}>
                          {options.map((o) => {
                            const active = value === o;
                            return (
                              <TouchableOpacity key={o} style={[s.chip, active && s.chipActive]} onPress={() => setMeta(field.key, active ? "" : o)}>
                                <Text style={[s.chipText, active && s.chipTextActive]}>{o}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={field.key}>
                      <Text style={s.fieldLabel}>{field.label}</Text>
                      <TextInput
                        style={s.input}
                        value={value}
                        onChangeText={(v) => setMeta(field.key, v)}
                        placeholder={field.type === "date" ? "YYYY-MM-DD" : field.label}
                        placeholderTextColor="#9ca3af"
                        keyboardType={field.type === "number" ? "numeric" : "default"}
                      />
                    </View>
                  );
                })}
              </>
            )}

            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Active (visible for mapping to opportunities)</Text>
              <Switch value={form.active} onValueChange={(v) => set("active", v)} trackColor={{ true: "#0f766e" }} />
            </View>
          </ScrollView>
          <View style={s.sheetFooter}>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={s.saveBtnText}>{editing ? "Save changes" : "Add item"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DomainCatalogScreen() {
  const [items, setItems] = useState<DomainItem[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DomainItem | null>(null);
  const [deletingId, setDeletingId] = useState<DomainItem["id"] | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/domain-items");
      setItems(normalizeList(res.data));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load catalog");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchItems();
    }, [fetchItems])
  );

  const catalogTypes = useMemo(() => {
    const keys = new Set(
      [...CATALOG_PRESETS.map((p) => p.key), ...items.map((i) => i.industryKey).filter(Boolean)].map(normalizeKey)
    );
    return [...keys].map((key) => ({ key, label: labelForType(key) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const visible = useMemo(() => {
    let list = filter === "ALL" ? items : items.filter((i) => normalizeKey(i.industryKey) === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.name, i.category, i.location, i.description].some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, filter, search]);

  function handleSaved(msg: string) {
    setInfo(msg);
    setTimeout(() => setInfo(""), 3000);
    fetchItems();
  }

  function confirmDelete(item: DomainItem) {
    Alert.alert("Delete Catalog Item", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await api.delete(`/api/domain-items/${item.id}`);
            setItems((cur) => cur.filter((i) => i.id !== item.id));
            handleSaved("Catalog item deleted.");
          } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Delete failed");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  if (loading && items.length === 0) return <LoadingSpinner message="Loading catalog…" />;

  return (
    <SafeAreaView edges={[]} style={s.root}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchItems(); }} />}
      {!!info && (
        <View style={s.infoBar}>
          <Ionicons name="checkmark-circle" size={15} color="#047857" />
          <Text style={s.infoBarText}>{info}</Text>
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchItems(); }}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <TextInput
              style={s.searchInput}
              placeholder="Search catalog…"
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[{ key: "ALL", label: "All" }, ...catalogTypes].map((t) => {
                const active = filter === t.key;
                return (
                  <TouchableOpacity key={t.key} style={[s.chip, active && s.chipActive]} onPress={() => setFilter(t.key)}>
                    <Text style={[s.chipText, active && s.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="albums-outline" size={30} color="#0f766e" />
            </View>
            <Text style={s.emptyTitle}>No catalog items</Text>
            <Text style={s.emptySub}>Tap + to add a property, course, vehicle, product, or custom item.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const metadata = cleanMetadata(parseMetadata(item.metadataJson));
          const defs = fieldDefinitionsFromItem(item);
          const labelFor = (key: string) => defs.find((d) => d.key === key)?.label || key;
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.price}>{formatMoney(item.price)}</Text>
              </View>
              <View style={s.badgeRow}>
                <View style={s.typeBadge}>
                  <Text style={s.typeBadgeText}>{labelForType(item.industryKey)}</Text>
                </View>
                {!!item.category && (
                  <View style={s.badge}><Text style={s.badgeText}>{item.category}</Text></View>
                )}
                {item.active === false && (
                  <View style={[s.badge, { backgroundColor: "#fef2f2" }]}>
                    <Text style={[s.badgeText, { color: "#b91c1c" }]}>Inactive</Text>
                  </View>
                )}
              </View>
              {!!item.location && (
                <View style={s.metaLine}>
                  <Ionicons name="location-outline" size={12} color="#64748b" />
                  <Text style={s.metaText} numberOfLines={1}>{item.location}</Text>
                </View>
              )}
              {!!item.description && <Text style={s.description} numberOfLines={2}>{item.description}</Text>}
              {Object.keys(metadata).length > 0 && (
                <View style={s.metaGrid}>
                  {Object.entries(metadata).slice(0, 6).map(([key, value]) => (
                    <View key={key} style={s.metaChip}>
                      <Text style={s.metaChipText}>
                        <Text style={{ color: "#6b7280" }}>{labelFor(key)}: </Text>
                        {String(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => { setEditing(item); setFormOpen(true); }}>
                  <Ionicons name="create-outline" size={14} color="#374151" />
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(item)} disabled={deletingId === item.id}>
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#dc2626" />
                      <Text style={s.deleteBtnText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => { setEditing(null); setFormOpen(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <ItemFormModal
        visible={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  infoBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ecfdf5", paddingHorizontal: 14, paddingVertical: 9,
  },
  infoBarText: { flex: 1, fontSize: 12.5, color: "#047857", fontWeight: "600" },
  searchInput: {
    backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#1e293b",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    backgroundColor: "rgba(118,118,128,0.08)",
  },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 12.5, fontWeight: "600", color: "#4b5563" },
  chipTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: {
    flex: 1, fontSize: 15, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  price: { fontSize: 14.5, fontWeight: "700", color: "#0f766e" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  typeBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#eef2ff" },
  typeBadgeText: { fontSize: 10.5, fontWeight: "700", color: "#4338ca" },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ccfbf1" },
  badgeText: { fontSize: 10.5, fontWeight: "700", color: "#0f766e" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: "#64748b", flexShrink: 1 },
  description: { fontSize: 13, color: "#64748b", lineHeight: 18 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    backgroundColor: "rgba(118,118,128,0.06)", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaChipText: { fontSize: 11.5, color: "#111827", fontWeight: "500" },
  cardActions: {
    flexDirection: "row", gap: 8, paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
  },
  editBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 10, minHeight: 36,
  },
  editBtnText: { fontSize: 12.5, fontWeight: "600", color: "#374151", fontFamily: mediumFont },
  deleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 10, minHeight: 36,
  },
  deleteBtnText: { fontSize: 12.5, fontWeight: "600", color: "#dc2626", fontFamily: mediumFont },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(15,118,110,0.08)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19 },
  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f766e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },

  // Form sheet
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.15)",
    backgroundColor: "#fff",
  },
  sheetTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  sheetBody: { padding: 16, gap: 10, paddingBottom: 120 },
  sheetFooter: {
    padding: 14, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.15)", backgroundColor: "#fff",
  },
  fieldLabel: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    fontFamily: mediumFont, marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11.5, fontWeight: "700", color: "#6b7280",
    letterSpacing: 0.6, textTransform: "uppercase", marginTop: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
    color: "#111827", backgroundColor: "#fff",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    backgroundColor: "rgba(118,118,128,0.05)", borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 9, marginTop: 8,
  },
  switchLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: "#374151", fontFamily: mediumFont },
  errorBox: { backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 12, padding: 12 },
  errorBoxText: { color: "#dc2626", fontSize: 13 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0f766e", borderRadius: 12, minHeight: 48,
  },
  saveBtnText: {
    fontSize: 15, fontWeight: "600", color: "#fff",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
});
