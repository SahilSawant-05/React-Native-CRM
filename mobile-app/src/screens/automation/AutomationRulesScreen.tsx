import React, { useCallback, useEffect, useState } from "react";
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
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationRule {
  id: number;
  name: string;
  triggerType: string;
  actionType: string;
  active: boolean;
  conditionLeadSource?: string;
  conditionStage?: string;
  dueInHours?: number;
  taskTitle?: string;
  taskDescription?: string;
  whatsappTemplateId?: number | string;
  emailTemplateId?: number | string;
  notificationTitle?: string;
  notificationBody?: string;
  delayInHours?: number | string;
  requireNoResponse?: boolean;
}

interface Template { id: number | string; name?: string; metaTemplateName?: string }
interface EmailTemplate { id: number | string; name?: string; subject?: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGERS: { value: string; label: string }[] = [
  { value: "CONTACT_CREATED",         label: "New lead" },
  { value: "OPPORTUNITY_STAGE_CHANGED", label: "Stage changed" },
  { value: "INBOUND_MESSAGE",          label: "Inbound message" },
  { value: "NO_RESPONSE",              label: "No response" },
];

const ACTIONS: { value: string; label: string }[] = [
  { value: "CREATE_TASK",              label: "Create task" },
  { value: "SEND_EMAIL",               label: "Send email" },
  { value: "SEND_WHATSAPP_TEMPLATE",   label: "Send WhatsApp template" },
  { value: "NOTIFY_AGENT",             label: "Notify agent" },
  { value: "CREATE_OPPORTUNITY",       label: "Create opportunity" },
];

const LEAD_SOURCES = [
  "WHATSAPP","EMAIL","WEBSITE","FACEBOOK","INSTAGRAM","GOOGLE_ADS","CSV_IMPORT","REFERRAL","MANUAL",
];

const EMPTY_FORM: Omit<AutomationRule, "id" | "active"> & { active: boolean } = {
  name: "",
  triggerType: "CONTACT_CREATED",
  actionType: "CREATE_TASK",
  active: true,
  conditionLeadSource: "",
  conditionStage: "",
  taskTitle: "Follow up with {{contactName}}",
  taskDescription: "",
  dueInHours: 24,
  delayInHours: "",
  requireNoResponse: false,
  notificationTitle: "Automation alert: {{contactName}}",
  notificationBody: "{{contactName}} needs attention.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelFor(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        <Text style={fs.selectText}>{selected?.label ?? value}</Text>
        <Ionicons name="chevron-down" size={16} color="#9ca3af" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={fs.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={fs.pickerSheet}>
            <Text style={fs.pickerTitle}>{label}</Text>
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
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleFormModal({
  visible, rule, onClose, onSaved,
}: {
  visible: boolean;
  rule: AutomationRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [waTemplates, setWaTemplates] = useState<Template[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (rule) {
      setForm({ ...EMPTY_FORM, ...rule });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setError("");
    // load templates
    api.get("/api/templates").then((r) => setWaTemplates(normalizeList(r.data))).catch(() => {});
    api.get("/api/crm-config/communication-templates", { params: { channel: "EMAIL" } })
      .then((r) => setEmailTemplates(normalizeList(r.data))).catch(() => {});
  }, [visible, rule]);

  function set(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Rule name is required."); return; }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      name: form.name.trim(),
      conditionLeadSource: form.conditionLeadSource || null,
      conditionStage: form.conditionStage || null,
      conditionPipelineId: null,
      conditionIndustryKey: null,
      targetStage: null,
      targetPipelineId: null,
      opportunityTitle: null,
      emailTemplateId: form.emailTemplateId ? Number(form.emailTemplateId) : null,
      emailSubject: null,
      emailBody: null,
      whatsappTemplateId: form.whatsappTemplateId ? Number(form.whatsappTemplateId) : null,
      notificationTitle: form.notificationTitle || null,
      notificationBody: form.notificationBody || null,
      delayInHours: form.delayInHours === "" ? null : Number(form.delayInHours) || null,
      requireNoResponse: Boolean(form.requireNoResponse),
      // dueInHours: form.dueInHours === "" ? null : Number(form.dueInHours) || 24,
      taskTitle: form.taskTitle || null,
      taskDescription: form.taskDescription || null,
    };
    try {
      if (rule?.id) {
        await api.put(`/api/automation-rules/${rule.id}`, payload);
      } else {
        await api.post("/api/automation-rules", payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  }

  const waOptions = waTemplates.map((t) => ({
    value: String(t.id),
    label: t.metaTemplateName || t.name || String(t.id),
  }));

  const emailOptions = emailTemplates.map((t) => ({
    value: String(t.id),
    label: t.subject || t.name || String(t.id),
  }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={fs.header}>
          <Text style={fs.headerTitle}>{rule ? "Edit Rule" : "New Automation Rule"}</Text>
          <TouchableOpacity onPress={onClose} style={fs.cancelBtn}>
            <Text style={fs.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* KeyboardAvoidingView wraps BOTH the scrollable form and the footer
            so the Save button rides up above the keyboard along with the inputs. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={fs.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {!!error && (
              <View style={fs.errorBox}>
                <Text style={fs.errorText}>{error}</Text>
              </View>
            )}

            {/* Name */}
            <View style={fs.field}>
              <Text style={fs.label}>Rule Name</Text>
              <TextInput
                style={fs.input}
                placeholder="e.g. Follow up new lead"
                placeholderTextColor="#94a3b8"
                value={form.name}
                onChangeText={(v) => set("name", v)}
              />
            </View>

            {/* Active toggle */}
            <View style={fs.switchRow}>
              <Text style={fs.label}>Active</Text>
              <Switch
                value={form.active}
                onValueChange={(v) => set("active", v)}
                trackColor={{ true: "#0f766e", false: "#cbd5e1" }}
                thumbColor="#fff"
              />
            </View>

            {/* Trigger */}
            <PickerRow
              label="Trigger"
              options={TRIGGERS}
              value={form.triggerType}
              onChange={(v) => set("triggerType", v)}
            />

            {/* Lead source condition */}
            <PickerRow
              label="Condition: Lead Source (optional)"
              options={[{ value: "", label: "Any" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))]}
              value={form.conditionLeadSource ?? ""}
              onChange={(v) => set("conditionLeadSource", v)}
            />

            {/* Delay */}
            <View style={fs.field}>
              <Text style={fs.label}>Delay (hours, optional)</Text>
              <TextInput
                style={fs.input}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={String(form.delayInHours ?? "")}
                onChangeText={(v) => set("delayInHours", v)}
              />
            </View>

            {/* Action */}
            <PickerRow
              label="Action"
              options={ACTIONS}
              value={form.actionType}
              onChange={(v) => set("actionType", v)}
            />

            {/* Action-specific fields */}
            {(form.actionType === "CREATE_TASK" || form.actionType === "NOTIFY_AGENT") && (
              <>
                <View style={fs.field}>
                  <Text style={fs.label}>
                    {form.actionType === "CREATE_TASK" ? "Task Title" : "Notification Title"}
                  </Text>
                  <TextInput
                    style={fs.input}
                    placeholder="Follow up with {{contactName}}"
                    placeholderTextColor="#94a3b8"
                    value={form.actionType === "CREATE_TASK" ? (form.taskTitle ?? "") : (form.notificationTitle ?? "")}
                    onChangeText={(v) =>
                      set(form.actionType === "CREATE_TASK" ? "taskTitle" : "notificationTitle", v)
                    }
                  />
                </View>
                <View style={fs.field}>
                  <Text style={fs.label}>
                    {form.actionType === "CREATE_TASK" ? "Task Description" : "Notification Body"}
                  </Text>
                  <TextInput
                    style={[fs.input, { height: 80, textAlignVertical: "top" }]}
                    placeholder="Description…"
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={form.actionType === "CREATE_TASK" ? (form.taskDescription ?? "") : (form.notificationBody ?? "")}
                    onChangeText={(v) =>
                      set(form.actionType === "CREATE_TASK" ? "taskDescription" : "notificationBody", v)
                    }
                  />
                </View>
                {form.actionType === "CREATE_TASK" && (
                  <View style={fs.field}>
                    <Text style={fs.label}>Due in (hours)</Text>
                    <TextInput
                      style={fs.input}
                      placeholder="24"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={String(form.dueInHours ?? 24)}
                      onChangeText={(v) => set("dueInHours", Number(v) || 24)}
                    />
                  </View>
                )}
              </>
            )}

            {form.actionType === "SEND_WHATSAPP_TEMPLATE" && (
              <PickerRow
                label="WhatsApp Template"
                options={waOptions.length ? waOptions : [{ value: "", label: "No approved templates" }]}
                value={String(form.whatsappTemplateId ?? "")}
                onChange={(v) => set("whatsappTemplateId", v)}
              />
            )}

            {form.actionType === "SEND_EMAIL" && (
              <PickerRow
                label="Email Template"
                options={emailOptions.length ? emailOptions : [{ value: "", label: "No email templates" }]}
                value={String(form.emailTemplateId ?? "")}
                onChange={(v) => set("emailTemplateId", v)}
              />
            )}
          </ScrollView>

          <View style={fs.footer}>
            <TouchableOpacity style={fs.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={fs.saveBtnText}>Save Rule</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AutomationRulesScreen() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/api/automation-rules");
      setRules(normalizeList(res.data));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function toggleActive(rule: AutomationRule) {
    const next = !rule.active;
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: next } : r));
    try {
      await api.put(`/api/automation-rules/${rule.id}`, {
        ...rule,
        active: next,
        conditionLeadSource: rule.conditionLeadSource || null,
        conditionStage: rule.conditionStage || null,
        conditionPipelineId: null,
        conditionIndustryKey: null,
        targetStage: null,
        targetPipelineId: null,
        opportunityTitle: null,
        emailTemplateId: rule.emailTemplateId ? Number(rule.emailTemplateId) : null,
        emailSubject: null,
        emailBody: null,
        whatsappTemplateId: rule.whatsappTemplateId ? Number(rule.whatsappTemplateId) : null,
        delayInHours: rule.delayInHours ? Number(rule.delayInHours) : null,
        requireNoResponse: Boolean(rule.requireNoResponse),
        dueInHours: Number(rule.dueInHours) || 24,
      });
    } catch {
      // revert optimistic update
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !next } : r));
      Alert.alert("Error", "Failed to update rule.");
    }
  }

  function confirmDelete(rule: AutomationRule) {
    Alert.alert("Delete Rule", `Delete "${rule.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/api/automation-rules/${rule.id}`);
            setRules((prev) => prev.filter((r) => r.id !== rule.id));
          } catch {
            Alert.alert("Error", "Failed to delete rule.");
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingSpinner message="Loading automation rules…" />;

  return (
    <SafeAreaView edges={[]} style={s.root}>
      {!!error && <ErrorBanner message={error} onRetry={() => { setLoading(true); load(); }} />}

      <FlatList
        data={rules}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={rules.length === 0 ? s.emptyWrap : { padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="flash-outline" size={44} color="#9ca3af" />
            <Text style={s.emptyTitle}>No automation rules</Text>
            <Text style={s.emptySub}>Tap + to create your first rule</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.ruleName}>{item.name}</Text>
                <View style={s.tagRow}>
                  <View style={s.tagTrigger}>
                    <Ionicons name="flash-outline" size={11} color="#374151" />
                    <Text style={s.tagText}>
                      {TRIGGERS.find((t) => t.value === item.triggerType)?.label ?? labelFor(item.triggerType)}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={12} color="#9ca3af" />
                  <View style={s.tagAction}>
                    <Ionicons name="play-outline" size={11} color="#15803d" />
                    <Text style={s.tagText}>
                      {ACTIONS.find((a) => a.value === item.actionType)?.label ?? labelFor(item.actionType)}
                    </Text>
                  </View>
                </View>
              </View>
              <Switch
                value={item.active}
                onValueChange={() => toggleActive(item)}
                trackColor={{ true: "#0f766e", false: "#cbd5e1" }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => { setEditing(item); setFormOpen(true); }}
              >
                <Ionicons name="create-outline" size={16} color="#374151" />
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => confirmDelete(item)}>
                <Ionicons name="trash-outline" size={16} color="#dc2626" />
                <Text style={s.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fontMedium = Platform.OS === "android" ? "sans-serif-medium" : undefined;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8f9fb" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  emptySub: { fontSize: 13.5, color: "#9ca3af", textAlign: "center" },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleName: {
    fontSize: 15, fontWeight: "600", color: "#111827",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  tagTrigger: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagAction: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#dcfce7", borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  cardActions: {
    flexDirection: "row", gap: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
  },
  editBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 12,
    minHeight: 44, alignItems: "center",
  },
  editBtnText: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  deleteBtn: {
    flex: 1, flexDirection: "row", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(220,38,38,0.08)", borderRadius: 12,
    minHeight: 44, alignItems: "center",
  },
  deleteBtnText: {
    fontSize: 13, fontWeight: "600", color: "#dc2626",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
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
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.12)",
    backgroundColor: "#fff",
  },
  headerTitle: {
    fontSize: 16, fontWeight: "600", color: "#111827",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  cancelBtn: {
    backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 12,
    paddingHorizontal: 14, minHeight: 36, justifyContent: "center",
  },
  cancelText: {
    color: "#374151", fontWeight: "600", fontSize: 14,
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
  },
  body: { padding: 16, gap: 14 },
  errorBox: {
    backgroundColor: "#fef2f2", borderRadius: 12, padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  field: { gap: 6 },
  label: {
    fontSize: 12.5, fontWeight: "600", color: "#6b7280",
    fontFamily: fontMedium,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 15,
    color: "#111827", backgroundColor: "rgba(118,118,128,0.06)",
  },
  switchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  select: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 12, minHeight: 46, backgroundColor: "rgba(118,118,128,0.06)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectText: {
    fontSize: 15, color: "#111827", flex: 1,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, paddingBottom: 30, gap: 2,
  },
  pickerTitle: {
    fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 8,
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  pickerItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 10, borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.12)",
  },
  pickerItemActive: { backgroundColor: "rgba(15,118,110,0.08)", borderBottomColor: "transparent" },
  pickerItemText: { fontSize: 14, color: "#374151" },
  pickerItemTextActive: {
    color: "#0f766e", fontWeight: "600",
    fontFamily: fontMedium,
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.12)",
    backgroundColor: "#fff",
  },
  saveBtn: {
    backgroundColor: "#0f766e", borderRadius: 12, minHeight: 48,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff", fontSize: 15, fontWeight: "600",
    fontFamily: fontMedium,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
});