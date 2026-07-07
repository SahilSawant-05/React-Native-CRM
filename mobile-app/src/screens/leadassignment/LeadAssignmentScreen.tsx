import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssignmentRule {
  id: number;
  name: string;
  criteriaType: string;
  criteriaValue?: string | null;
  assignmentStrategy: string;   // "ASSIGN_USER" | "ROUND_ROBIN"
  assignedUserId?: number | string | null;
  assignedUserIds?: (number | string)[];
  active?: boolean;
  priority?: number;
}

interface CrmUser {
  id: number | string;
  name?: string;
  email?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Kept in sync with the web app (LeadAssignmentRules.jsx) so criteria created
// on mobile actually match leads the same way rules created on web do.

const CRITERIA_TYPES = [
  { value: "LEAD_SOURCE",     label: "Lead Source" },
  { value: "WEBSITE_DOMAIN",  label: "Website Domain" },
  { value: "INDUSTRY",        label: "Industry" },
  { value: "CITY",            label: "City" },
  { value: "TAG",             label: "Tag" },
  { value: "DEFAULT",         label: "Default fallback" },
];

const LEAD_SOURCES = [
  "WHATSAPP","WEBSITE_FORM","WEBSITE","FACEBOOK","INSTAGRAM",
  "GOOGLE_ADS","REFERRAL","WALK_IN","PORTAL","CAMPAIGN","OTHER",
];

// These are the actual backend enum values used for industryKey — must match
// web's INDUSTRIES list exactly, or an INDUSTRY rule created here will never
// match a real lead. Previously this list had free-text labels
// ("Technology", "Healthcare", etc.) that don't correspond to any stored
// industryKey value.
const INDUSTRIES = [
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "EDUCATION",   label: "Education" },
  { value: "BIKE_SALES",  label: "Bike Sales" },
  { value: "GENERIC",     label: "Generic" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

// ─── Picker Row ───────────────────────────────────────────────────────────────

function PickerRow({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={fs.field}>
      <Text style={fs.label}>{label}</Text>
      <TouchableOpacity style={fs.select} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={fs.selectText}>{selected?.label ?? value ?? "Select…"}</Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={fs.pickerSheet}>
            <Text style={fs.pickerTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {options.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[fs.pickerItem, o.value === value && fs.pickerItemActive]}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                >
                  <Text style={[fs.pickerItemText, o.value === value && fs.pickerItemTextActive]}>
                    {o.label}
                  </Text>
                  {o.value === value && <Ionicons name="checkmark" size={18} color="#0f766e" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleFormModal({
  visible, rule, users, onClose, onSaved,
}: {
  visible: boolean;
  rule: AssignmentRule | null;
  users: CrmUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [criteriaType, setCriteriaType] = useState("LEAD_SOURCE");
  const [criteriaValue, setCriteriaValue] = useState("");
  const [assignmentStrategy, setAssignmentStrategy] = useState("ASSIGN_USER");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [priority, setPriority] = useState("100");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (rule) {
      setName(rule.name ?? "");
      setCriteriaType(rule.criteriaType ?? "LEAD_SOURCE");
      setCriteriaValue(rule.criteriaValue ?? "");
      setAssignmentStrategy(rule.assignmentStrategy ?? "ASSIGN_USER");
      setAssignedUserId(String(rule.assignedUserId ?? ""));
      setPriority(String(rule.priority ?? 100));
    } else {
      setName("");
      setCriteriaType("LEAD_SOURCE");
      setCriteriaValue("");
      setAssignmentStrategy("ASSIGN_USER");
      setAssignedUserId("");
      setPriority("100");
    }
    setError("");
  }, [visible, rule]);

  async function handleSave() {
    if (!name.trim()) { setError("Rule name is required."); return; }
    if (assignmentStrategy === "ASSIGN_USER" && !assignedUserId) {
      setError("Please select an agent to assign leads to.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(),
      criteriaType,
      criteriaValue: criteriaType === "DEFAULT" ? null : (criteriaValue || null),
      assignmentStrategy,
      assignedUserId: assignmentStrategy === "ASSIGN_USER" ? Number(assignedUserId) : null,
      assignedUserIds: [],
      active: true,
      priority: Number(priority) || 100,
    };
    try {
      if (rule?.id) {
        await api.put(`/api/lead-assignment-rules/${rule.id}`, payload);
      } else {
        await api.post("/api/lead-assignment-rules", payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  }

  const userOptions = users.map((u) => ({
    value: String(u.id),
    label: u.name || u.email || String(u.id),
  }));

  // Picker-backed criteria types (values must match backend enums exactly).
  // Free-text criteria types (CITY, WEBSITE_DOMAIN, TAG) fall through to a
  // plain text input below, same as web.
  const criteriaValueOptions =
    criteriaType === "LEAD_SOURCE"
      ? LEAD_SOURCES.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))
      : criteriaType === "INDUSTRY"
      ? INDUSTRIES
      : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={fs.header}>
          <Text style={fs.headerTitle}>{rule ? "Edit Rule" : "New Assignment Rule"}</Text>
          <TouchableOpacity onPress={onClose} style={fs.cancelBtn}>
            <Text style={fs.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={fs.body} keyboardShouldPersistTaps="handled">
          {!!error && (
            <View style={fs.errorBox}>
              <Text style={fs.errorText}>{error}</Text>
            </View>
          )}

          <View style={fs.field}>
            <Text style={fs.label}>Rule Name</Text>
            <TextInput
              style={fs.input}
              placeholder="e.g. WhatsApp leads → Rahul"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
            />
          </View>

          <PickerRow
            label="Assignment Strategy"
            options={[
              { value: "ASSIGN_USER", label: "Assign to specific agent" },
              { value: "ROUND_ROBIN", label: "Round robin (not supported on mobile)" },
            ]}
            value={assignmentStrategy}
            onChange={setAssignmentStrategy}
          />

          {assignmentStrategy === "ASSIGN_USER" && (
            <PickerRow
              label="Assign To (Agent)"
              options={userOptions.length ? userOptions : [{ value: "", label: "No agents found" }]}
              value={assignedUserId}
              onChange={setAssignedUserId}
            />
          )}

          <PickerRow
            label="Criteria Type"
            options={CRITERIA_TYPES}
            value={criteriaType}
            onChange={(v) => { setCriteriaType(v); setCriteriaValue(""); }}
          />

          {criteriaType !== "DEFAULT" && (
            criteriaValueOptions ? (
              <PickerRow
                label="Criteria Value"
                options={criteriaValueOptions}
                value={criteriaValue}
                onChange={setCriteriaValue}
              />
            ) : (
              <View style={fs.field}>
                <Text style={fs.label}>
                  Criteria Value{" "}
                  <Text style={{ color: "#9ca3af", fontWeight: "400" }}>
                    ({criteriaType === "CITY" ? "e.g. Mumbai" : criteriaType === "WEBSITE_DOMAIN" ? "e.g. example.com" : "e.g. hot-lead"})
                  </Text>
                </Text>
                <TextInput
                  style={fs.input}
                  placeholder={
                    criteriaType === "CITY" ? "Mumbai" :
                    criteriaType === "WEBSITE_DOMAIN" ? "example.com" : "value"
                  }
                  placeholderTextColor="#9ca3af"
                  value={criteriaValue}
                  onChangeText={setCriteriaValue}
                  autoCapitalize="none"
                />
              </View>
            )
          )}

          <View style={fs.field}>
            <Text style={fs.label}>Priority (higher = matched first)</Text>
            <TextInput
              style={fs.input}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={priority}
              onChangeText={setPriority}
            />
          </View>
        </ScrollView>

        <View style={fs.footer}>
          <TouchableOpacity style={fs.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={fs.saveBtnText}>Save Rule</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeadAssignmentScreen() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRule | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [rulesRes, usersRes] = await Promise.all([
        api.get("/api/lead-assignment-rules"),
        api.get("/api/users"),
      ]);
      setRules(normalizeList(rulesRes.data));
      setUsers(normalizeList(usersRes.data));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function confirmDelete(rule: AssignmentRule) {
    Alert.alert("Delete Rule", `Delete "${rule.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/api/lead-assignment-rules/${rule.id}`);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
          } catch {
            Alert.alert("Error", "Failed to delete rule.");
          }
        },
      },
    ]);
  }

  function agentName(rule: AssignmentRule) {
    if (rule.assignmentStrategy === "ROUND_ROBIN") return "Round Robin";
    const uid = rule.assignedUserId;
    if (!uid) return "Unassigned";
    const u = users.find((u) => String(u.id) === String(uid));
    return u ? (u.name || u.email || String(uid)) : String(uid);
  }

  // For display in the list: turn a stored enum value like "REAL_ESTATE" or
  // "GOOGLE_ADS" back into a friendly label using the same lookup tables
  // used by the form, falling back to the raw value if not found.
  function criteriaValueLabel(item: AssignmentRule) {
    if (!item.criteriaValue) return "";
    if (item.criteriaType === "INDUSTRY") {
      return INDUSTRIES.find((i) => i.value === item.criteriaValue)?.label ?? item.criteriaValue;
    }
    if (item.criteriaType === "LEAD_SOURCE") {
      return item.criteriaValue.replaceAll("_", " ");
    }
    return item.criteriaValue;
  }

  if (loading) return <LoadingSpinner message="Loading assignment rules…" />;

  return (
    <SafeAreaView edges={["bottom"]} style={s.root}>
      {!!error && <ErrorBanner message={error} onRetry={() => { setLoading(true); load(); }} />}

      <FlatList
        data={rules}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={rules.length === 0 ? s.emptyWrap : { padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="git-branch-outline" size={30} color="#0f766e" />
            </View>
            <Text style={s.emptyTitle}>No assignment rules</Text>
            <Text style={s.emptySub}>Tap + to create your first rule</Text>
          </View>
        }
        renderItem={({ item }) => {
          const criteria = CRITERIA_TYPES.find((c) => c.value === item.criteriaType);
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.ruleName}>{item.name}</Text>
                {item.priority !== undefined && item.priority !== 0 && (
                  <View style={s.priorityBadge}>
                    <Text style={s.priorityText}>P{item.priority}</Text>
                  </View>
                )}
              </View>

              <View style={s.metaRow}>
                <View style={s.metaChip}>
                  <Text style={s.metaChipText}>
                    {criteria?.label ?? item.criteriaType}
                    {item.criteriaValue ? ` = ${criteriaValueLabel(item)}` : ""}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={13} color="#9ca3af" />
                <View style={s.metaChipAgent}>
                  <Ionicons name="person-outline" size={11} color="#0f766e" />
                  <Text style={s.metaChipAgentText}>{agentName(item)}</Text>
                </View>
              </View>

              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.editBtn}
                  onPress={() => { setEditing(item); setFormOpen(true); }}
                >
                  <Ionicons name="create-outline" size={15} color="#374151" />
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(item)}>
                  <Ionicons name="trash-outline" size={15} color="#dc2626" />
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => { setEditing(null); setFormOpen(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <RuleFormModal
        visible={formOpen}
        rule={editing}
        users={users}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const cardShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
} as const;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(15,118,110,0.08)",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  emptySub: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    ...cardShadow,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ruleName: {
    fontSize: 15, fontWeight: "600", color: "#111827", flex: 1,
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  priorityBadge: {
    backgroundColor: "#fef3c7", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3,
  },
  priorityText: { fontSize: 11, fontWeight: "600", color: "#92400e" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaChip: {
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5,
  },
  metaChipAgent: {
    backgroundColor: "rgba(15,118,110,0.08)", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  metaChipText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  metaChipAgentText: { fontSize: 11, fontWeight: "600", color: "#0f766e" },
  cardActions: {
    flexDirection: "row", gap: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
  },
  editBtn: {
    flex: 1, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 12,
    minHeight: 40, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  editBtnText: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  deleteBtn: {
    flex: 1, backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 12,
    minHeight: 40, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 6,
  },
  deleteBtnText: {
    fontSize: 13, fontWeight: "600", color: "#dc2626",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  fab: {
    position: "absolute", bottom: 16, right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f766e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
});

const fs = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 18, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)", backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  cancelBtn: {
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 99,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  cancelText: {
    color: "#374151", fontSize: 13, fontWeight: "600",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  body: { padding: 16, gap: 14 },
  errorBox: {
    backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 12,
    padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  field: { gap: 6 },
  label: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: "#111827", backgroundColor: "rgba(118,118,128,0.06)",
  },
  select: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "rgba(118,118,128,0.06)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectText: { fontSize: 15, color: "#111827", flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 16, paddingBottom: 30, gap: 2,
  },
  pickerTitle: {
    fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 8,
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 10, borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: "rgba(15,118,110,0.08)" },
  pickerItemText: { fontSize: 14, color: "#374151" },
  pickerItemTextActive: {
    color: "#0f766e", fontWeight: "600",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  footer: {
    padding: 16, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.12)", backgroundColor: "#fff",
  },
  saveBtn: {
    backgroundColor: "#0f766e", borderRadius: 12, minHeight: 48,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    fontFamily: mediumFont, letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
});