import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  conditionPipelineId?: number | string | null;
  conditionCallStatus?: string;
  conditionCallDisposition?: string;
  conditionCallDirection?: string;
  conditionAgentUserId?: number | string | null;
  taskTitle?: string;
  taskDescription?: string;
  dueInHours?: number | string;
  targetStage?: string;
  targetPipelineId?: number | string | null;
  opportunityTitle?: string;
  whatsappTemplateId?: number | string;
  emailTemplateId?: number | string;
  emailSubject?: string;
  emailBody?: string;
  notificationTitle?: string;
  notificationBody?: string;
  delayInHours?: number | string;
  requireNoResponse?: boolean;
}

interface Template { id: number | string; name?: string; metaTemplateName?: string; languageCode?: string }
interface EmailTemplate { id: number | string; name?: string; subject?: string }
interface Pipeline { id: number | string; name?: string; defaultPipeline?: boolean }
interface StageOption { key: string; label: string }
interface CrmUser { id: number | string; name?: string; fullName?: string; email?: string }

// ─── Constants (mirror ainew/src/pages/AutomationRules.jsx) ────────────────────

const TRIGGERS: { value: string; label: string }[] = [
  { value: "CONTACT_CREATED",           label: "New lead/contact created" },
  { value: "EMAIL_RECEIVED",            label: "Email received" },
  { value: "WHATSAPP_RECEIVED",         label: "WhatsApp message received" },
  { value: "WHATSAPP_FLOW_SUBMITTED",   label: "WhatsApp Flow submitted" },
  { value: "OPPORTUNITY_STAGE_CHANGED", label: "Opportunity stage changed" },
  { value: "CALL_OUTCOME_UPDATED",      label: "Call outcome updated" },
];

const BASE_ACTIONS: { value: string; label: string }[] = [
  { value: "CREATE_TASK",            label: "Create task" },
  { value: "CREATE_OPPORTUNITY",     label: "Create opportunity in pipeline" },
  { value: "SEND_EMAIL",             label: "Send email" },
  { value: "SEND_WHATSAPP_TEMPLATE", label: "Send WhatsApp template" },
  { value: "NOTIFY_AGENT",           label: "Notify agent" },
  { value: "AI_LEAD_SCORE",          label: "Run AI lead score" },
];

const MOVE_STAGE_ACTION = { value: "MOVE_OPPORTUNITY_STAGE", label: "Move opportunity stage" };

const CALL_STATUS_OPTIONS = ["REQUESTED", "RINGING", "IN_PROGRESS", "COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "CANCELLED"];
const CALL_DISPOSITION_OPTIONS = ["INTERESTED", "NOT_INTERESTED", "CALL_BACK_LATER", "FOLLOW_UP_REQUIRED", "WRONG_NUMBER", "NO_ANSWER", "CONVERTED"];
const CALL_DIRECTION_OPTIONS = ["OUTBOUND", "INBOUND"];

const LEAD_SOURCE_OPTIONS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "WEBSITE_FORM", label: "Website Form" },
  { value: "WEBSITE", label: "Website" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PORTAL", label: "Portal" },
  { value: "CAMPAIGN", label: "Campaign" },
  { value: "CSV_IMPORT", label: "CSV / Excel Import" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTHER", label: "Other" },
];

const EMPTY_FORM = {
  name: "",
  triggerType: "CONTACT_CREATED",
  active: true,
  conditionLeadSource: "",
  conditionStage: "",
  conditionPipelineId: "",
  conditionCallStatus: "",
  conditionCallDisposition: "",
  conditionCallDirection: "",
  conditionAgentUserId: "",
  actionType: "CREATE_TASK",
  taskTitle: "Follow up with {{contactName}}",
  taskDescription: "Automation triggered from {{emailSubject}}{{opportunityTitle}}",
  dueInHours: "24",
  targetStage: "",
  targetPipelineId: "",
  opportunityTitle: "{{contactName}} enquiry",
  emailTemplateId: "",
  emailSubject: "Following up with {{contactName}}",
  emailBody: "Hi {{contactName}},\n\nThanks for your interest. I wanted to follow up and help with the next step.",
  whatsappTemplateId: "",
  notificationTitle: "Automation alert: {{contactName}}",
  notificationBody: "{{contactName}} needs attention. Source: {{leadSource}}",
  delayInHours: "",
  requireNoResponse: false,
};

type FormState = typeof EMPTY_FORM;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelFor(value: string) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function userName(user?: CrmUser) {
  return user?.name || user?.fullName || user?.email || `User #${user?.id}`;
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
        <Text style={fs.selectText} numberOfLines={1}>{selected?.label ?? value ?? "Select…"}</Text>
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

function LabeledInput({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={fs.field}>
      <Text style={fs.label}>{label}</Text>
      <TextInput
        style={[fs.input, multiline && { height: 90, textAlignVertical: "top" }]}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleFormModal({
  visible, rule, pipelines, users, onClose, onSaved,
}: {
  visible: boolean;
  rule: AutomationRule | null;
  pipelines: Pipeline[];
  users: CrmUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [waTemplates, setWaTemplates] = useState<Template[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (rule) {
      setForm({
        ...EMPTY_FORM,
        ...rule,
        active: rule.active !== false,
        conditionPipelineId: rule.conditionPipelineId != null ? String(rule.conditionPipelineId) : "",
        conditionAgentUserId: rule.conditionAgentUserId != null ? String(rule.conditionAgentUserId) : "",
        targetPipelineId: rule.targetPipelineId != null ? String(rule.targetPipelineId) : "",
        emailTemplateId: rule.emailTemplateId != null ? String(rule.emailTemplateId) : "",
        whatsappTemplateId: rule.whatsappTemplateId != null ? String(rule.whatsappTemplateId) : "",
        dueInHours: rule.dueInHours != null ? String(rule.dueInHours) : "",
        delayInHours: rule.delayInHours != null ? String(rule.delayInHours) : "",
        requireNoResponse: Boolean(rule.requireNoResponse),
      } as FormState);
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setError("");
    api.get("/api/templates").then((r) => setWaTemplates(normalizeList(r.data))).catch(() => {});
    api.get("/api/crm-config/communication-templates", { params: { channel: "EMAIL" } })
      .then((r) => setEmailTemplates(normalizeList(r.data))).catch(() => {});
  }, [visible, rule]);

  // Which pipeline drives the stage picker: target > condition > default pipeline.
  const selectedStagePipelineId = useMemo(() => {
    return (
      form.targetPipelineId ||
      form.conditionPipelineId ||
      String(pipelines.find((p) => p.defaultPipeline)?.id || pipelines[0]?.id || "")
    );
  }, [form.targetPipelineId, form.conditionPipelineId, pipelines]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    if (!selectedStagePipelineId) { setStages([]); return; }
    api.get("/api/crm-config/pipeline-stages", { params: { pipelineId: selectedStagePipelineId } })
      .then((r) => {
        if (cancelled) return;
        const list = normalizeList(r.data)
          .filter((st: any) => st.active !== false)
          .map((st: any) => ({ key: st.stageKey || st.key, label: st.label || st.stageKey || st.key }));
        setStages(list);
      })
      .catch(() => { if (!cancelled) setStages([]); });
    return () => { cancelled = true; };
  }, [visible, selectedStagePipelineId]);

  function set(key: keyof FormState, value: any) {
    setForm((prev) => {
      const next: FormState = { ...prev, [key]: value };
      // Reset dependent fields when the trigger changes (mirrors web setValue).
      if (key === "triggerType") {
        if (value !== "OPPORTUNITY_STAGE_CHANGED") {
          next.conditionStage = "";
          next.conditionPipelineId = "";
          if (prev.actionType === "MOVE_OPPORTUNITY_STAGE" && value !== "CALL_OUTCOME_UPDATED") {
            next.actionType = "CREATE_TASK";
          }
        }
        if (value !== "CALL_OUTCOME_UPDATED") {
          next.conditionCallStatus = "";
          next.conditionCallDisposition = "";
          next.conditionCallDirection = "";
          next.conditionAgentUserId = "";
        }
        if (value === "OPPORTUNITY_STAGE_CHANGED") {
          next.conditionLeadSource = "";
        }
      }
      if (key === "conditionPipelineId") next.conditionStage = "";
      if (key === "targetPipelineId") next.targetStage = "";
      return next;
    });
  }

  const supportsMoveStage = form.triggerType === "OPPORTUNITY_STAGE_CHANGED" || form.triggerType === "CALL_OUTCOME_UPDATED";
  const actionOptions = supportsMoveStage ? [...BASE_ACTIONS, MOVE_STAGE_ACTION] : BASE_ACTIONS;

  const pipelineOptions = pipelines.map((p) => ({ value: String(p.id), label: p.name || `Pipeline #${p.id}` }));
  const stageOptions = stages.map((st) => ({ value: st.key, label: st.label }));
  const agentOptions = users.map((u) => ({ value: String(u.id), label: userName(u) }));
  const waOptions = waTemplates.map((t) => ({
    value: String(t.id),
    label: `${t.metaTemplateName || t.name || `Template #${t.id}`}${t.languageCode ? ` (${t.languageCode})` : ""}`,
  }));
  const emailOptions = emailTemplates.map((t) => ({ value: String(t.id), label: t.name || t.subject || `Template #${t.id}` }));

  async function handleSave() {
    if (!form.name.trim()) { setError("Rule name is required."); return; }
    setSaving(true);
    setError("");
    const payload: any = {
      name: form.name.trim(),
      triggerType: form.triggerType,
      active: Boolean(form.active),
      conditionStage: form.conditionStage || null,
      conditionPipelineId: form.conditionPipelineId ? Number(form.conditionPipelineId) : null,
      conditionLeadSource: form.conditionLeadSource || null,
      conditionIndustryKey: null,
      conditionCallStatus: form.conditionCallStatus || null,
      conditionCallDisposition: form.conditionCallDisposition || null,
      conditionCallDirection: form.conditionCallDirection || null,
      conditionAgentUserId: form.conditionAgentUserId ? Number(form.conditionAgentUserId) : null,
      actionType: form.actionType,
      taskTitle: form.taskTitle || null,
      taskDescription: form.taskDescription || null,
      dueInHours: form.dueInHours === "" ? null : Number(form.dueInHours),
      targetStage: form.targetStage || null,
      targetPipelineId: form.targetPipelineId ? Number(form.targetPipelineId) : null,
      opportunityTitle: form.opportunityTitle || null,
      emailTemplateId: form.emailTemplateId ? Number(form.emailTemplateId) : null,
      emailSubject: form.emailSubject || null,
      emailBody: form.emailBody || null,
      whatsappTemplateId: form.whatsappTemplateId ? Number(form.whatsappTemplateId) : null,
      notificationTitle: form.notificationTitle || null,
      notificationBody: form.notificationBody || null,
      delayInHours: form.delayInHours === "" ? null : Number(form.delayInHours),
      requireNoResponse: Boolean(form.requireNoResponse),
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={fs.header}>
          <Text style={fs.headerTitle}>{rule ? "Edit Rule" : "New Automation Rule"}</Text>
          <TouchableOpacity onPress={onClose} style={fs.cancelBtn}>
            <Text style={fs.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={fs.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {!!error && (
              <View style={fs.errorBox}><Text style={fs.errorText}>{error}</Text></View>
            )}

            {/* ── Rule name + active ── */}
            <LabeledInput label="Rule Name" value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Follow up new lead" />
            <View style={fs.switchRow}>
              <Text style={fs.label}>Active</Text>
              <Switch value={form.active} onValueChange={(v) => set("active", v)} trackColor={{ true: "#0f766e", false: "#cbd5e1" }} thumbColor="#fff" />
            </View>

            {/* ── 1. Trigger ── */}
            <Text style={fs.sectionTitle}>1 · Trigger</Text>
            <PickerRow label="When this happens" options={TRIGGERS} value={form.triggerType} onChange={(v) => set("triggerType", v)} />

            {/* ── 2. Conditions (depend on trigger) ── */}
            <Text style={fs.sectionTitle}>2 · Conditions</Text>
            {form.triggerType === "CALL_OUTCOME_UPDATED" ? (
              <>
                <PickerRow label="Call status" options={[{ value: "", label: "Any status" }, ...CALL_STATUS_OPTIONS.map((v) => ({ value: v, label: labelFor(v) }))]} value={form.conditionCallStatus} onChange={(v) => set("conditionCallStatus", v)} />
                <PickerRow label="Call outcome" options={[{ value: "", label: "Any outcome" }, ...CALL_DISPOSITION_OPTIONS.map((v) => ({ value: v, label: labelFor(v) }))]} value={form.conditionCallDisposition} onChange={(v) => set("conditionCallDisposition", v)} />
                <PickerRow label="Direction" options={[{ value: "", label: "Any direction" }, ...CALL_DIRECTION_OPTIONS.map((v) => ({ value: v, label: labelFor(v) }))]} value={form.conditionCallDirection} onChange={(v) => set("conditionCallDirection", v)} />
                <PickerRow label="Agent" options={[{ value: "", label: "Any agent" }, ...agentOptions]} value={form.conditionAgentUserId} onChange={(v) => set("conditionAgentUserId", v)} />
                <PickerRow label="Contact source" options={[{ value: "", label: "Any source" }, ...LEAD_SOURCE_OPTIONS]} value={form.conditionLeadSource} onChange={(v) => set("conditionLeadSource", v)} />
              </>
            ) : form.triggerType === "OPPORTUNITY_STAGE_CHANGED" ? (
              <>
                <PickerRow label="Pipeline" options={[{ value: "", label: "Any pipeline" }, ...pipelineOptions]} value={form.conditionPipelineId} onChange={(v) => set("conditionPipelineId", v)} />
                <PickerRow label="When stage becomes" options={[{ value: "", label: "Any stage" }, ...stageOptions]} value={form.conditionStage} onChange={(v) => set("conditionStage", v)} />
              </>
            ) : (
              <PickerRow label="Lead source filter" options={[{ value: "", label: "Any source" }, ...LEAD_SOURCE_OPTIONS]} value={form.conditionLeadSource} onChange={(v) => set("conditionLeadSource", v)} />
            )}

            {/* ── 3. Action ── */}
            <Text style={fs.sectionTitle}>3 · Action</Text>
            <PickerRow label="Do this" options={actionOptions} value={form.actionType} onChange={(v) => set("actionType", v)} />

            {/* Action-specific detail fields */}
            {form.actionType === "CREATE_TASK" && (
              <>
                <LabeledInput label="Task title" value={form.taskTitle} onChangeText={(v) => set("taskTitle", v)} placeholder="Follow up with {{contactName}}" />
                <LabeledInput label="Task description" value={form.taskDescription} onChangeText={(v) => set("taskDescription", v)} multiline />
                <LabeledInput label="Due in hours" value={String(form.dueInHours)} onChangeText={(v) => set("dueInHours", v)} keyboardType="numeric" placeholder="24" />
              </>
            )}

            {form.actionType === "CREATE_OPPORTUNITY" && (
              <>
                <LabeledInput label="Opportunity title" value={form.opportunityTitle} onChangeText={(v) => set("opportunityTitle", v)} placeholder="{{contactName}} enquiry" />
                <PickerRow label="Pipeline" options={[{ value: "", label: "Select pipeline" }, ...pipelineOptions]} value={form.targetPipelineId} onChange={(v) => set("targetPipelineId", v)} />
                <PickerRow label="Pipeline stage" options={[{ value: "", label: "First active stage" }, ...stageOptions]} value={form.targetStage} onChange={(v) => set("targetStage", v)} />
                {!form.targetPipelineId && (
                  <Text style={fs.hint}>Select the exact pipeline. The new opportunity is created only in that pipeline.</Text>
                )}
              </>
            )}

            {form.actionType === "MOVE_OPPORTUNITY_STAGE" && (
              <>
                <PickerRow label="Pipeline" options={[{ value: "", label: "Use trigger pipeline" }, ...pipelineOptions]} value={form.conditionPipelineId} onChange={(v) => set("conditionPipelineId", v)} />
                <PickerRow label="Target stage" options={[{ value: "", label: "Select stage" }, ...stageOptions]} value={form.targetStage} onChange={(v) => set("targetStage", v)} />
              </>
            )}

            {form.actionType === "SEND_EMAIL" && (
              <>
                <PickerRow label="Email template" options={[{ value: "", label: "No template / manual content" }, ...emailOptions]} value={form.emailTemplateId} onChange={(v) => set("emailTemplateId", v)} />
                <LabeledInput label="Subject" value={form.emailSubject} onChangeText={(v) => set("emailSubject", v)} placeholder="Following up with {{contactName}}" />
                <LabeledInput label="Body" value={form.emailBody} onChangeText={(v) => set("emailBody", v)} multiline />
              </>
            )}

            {form.actionType === "SEND_WHATSAPP_TEMPLATE" && (
              <PickerRow
                label="WhatsApp template"
                options={waOptions.length ? [{ value: "", label: "Select template" }, ...waOptions] : [{ value: "", label: "No approved templates" }]}
                value={form.whatsappTemplateId}
                onChange={(v) => set("whatsappTemplateId", v)}
              />
            )}

            {form.actionType === "NOTIFY_AGENT" && (
              <>
                <LabeledInput label="Notification title" value={form.notificationTitle} onChangeText={(v) => set("notificationTitle", v)} placeholder="Automation alert: {{contactName}}" />
                <LabeledInput label="Notification body" value={form.notificationBody} onChangeText={(v) => set("notificationBody", v)} multiline />
              </>
            )}

            {form.actionType === "AI_LEAD_SCORE" && (
              <View style={fs.aiCard}>
                <Text style={fs.aiTitle}>AI lead scoring automation</Text>
                <Text style={fs.aiBody}>
                  When this rule runs, Vistaar Flow sends the contact context to the configured AI provider,
                  saves a 0–100 lead score, adds an AI note to the timeline, and notifies the owner.
                </Text>
                <Text style={fs.aiWarn}>Requires Growth plan or higher, active AI settings, and available AI credits.</Text>
              </View>
            )}

            {/* ── 4. Timing ── */}
            <Text style={fs.sectionTitle}>4 · Timing</Text>
            <LabeledInput label="Delay in hours (0 = run immediately)" value={String(form.delayInHours)} onChangeText={(v) => set("delayInHours", v)} keyboardType="numeric" placeholder="0" />
            <TouchableOpacity style={fs.checkRow} activeOpacity={0.7} onPress={() => set("requireNoResponse", !form.requireNoResponse)}>
              <Ionicons
                name={form.requireNoResponse ? "checkbox" : "square-outline"}
                size={22}
                color={form.requireNoResponse ? "#0f766e" : "#9ca3af"}
              />
              <View style={{ flex: 1 }}>
                <Text style={fs.checkTitle}>Only if no lead response</Text>
                <Text style={fs.checkSub}>For delayed rules, skip the action if an inbound WhatsApp or email arrives before the delay ends.</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={fs.footer}>
            <TouchableOpacity style={fs.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={fs.saveBtnText}>{rule ? "Update Rule" : "Create Rule"}</Text>}
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
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [rulesRes, pipelinesRes, usersRes] = await Promise.all([
        api.get("/api/automation-rules"),
        api.get("/api/pipelines").catch(() => ({ data: [] })),
        api.get("/api/users").catch(() => ({ data: [] })),
      ]);
      setRules(normalizeList(rulesRes.data));
      setPipelines(normalizeList(pipelinesRes.data));
      setUsers(normalizeList(usersRes.data));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const toRulePayload = useCallback((rule: AutomationRule, active: boolean): any => ({
    name: rule.name || "",
    triggerType: rule.triggerType || "CONTACT_CREATED",
    active,
    conditionStage: rule.conditionStage || null,
    conditionPipelineId: rule.conditionPipelineId ? Number(rule.conditionPipelineId) : null,
    conditionLeadSource: rule.conditionLeadSource || null,
    conditionIndustryKey: null,
    conditionCallStatus: rule.conditionCallStatus || null,
    conditionCallDisposition: rule.conditionCallDisposition || null,
    conditionCallDirection: rule.conditionCallDirection || null,
    conditionAgentUserId: rule.conditionAgentUserId ? Number(rule.conditionAgentUserId) : null,
    actionType: rule.actionType || "CREATE_TASK",
    taskTitle: rule.taskTitle || null,
    taskDescription: rule.taskDescription || null,
    dueInHours: rule.dueInHours ?? null,
    targetStage: rule.targetStage || null,
    targetPipelineId: rule.targetPipelineId ? Number(rule.targetPipelineId) : null,
    opportunityTitle: rule.opportunityTitle || null,
    emailTemplateId: rule.emailTemplateId ? Number(rule.emailTemplateId) : null,
    emailSubject: rule.emailSubject || null,
    emailBody: rule.emailBody || null,
    whatsappTemplateId: rule.whatsappTemplateId ? Number(rule.whatsappTemplateId) : null,
    notificationTitle: rule.notificationTitle || null,
    notificationBody: rule.notificationBody || null,
    delayInHours: rule.delayInHours ?? null,
    requireNoResponse: Boolean(rule.requireNoResponse),
  }), []);

  async function toggleActive(rule: AutomationRule) {
    const next = !rule.active;
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: next } : r));
    try {
      await api.put(`/api/automation-rules/${rule.id}`, toRulePayload(rule, next));
    } catch {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !next } : r));
      Alert.alert("Error", "Failed to update rule.");
    }
  }

  function confirmDelete(rule: AutomationRule) {
    Alert.alert("Delete Rule", `Delete "${rule.name}"? Future matching leads will no longer be processed.`, [
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
                      {[...BASE_ACTIONS, MOVE_STAGE_ACTION].find((a) => a.value === item.actionType)?.label ?? labelFor(item.actionType)}
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
              <TouchableOpacity style={s.editBtn} onPress={() => { setEditing(item); setFormOpen(true); }}>
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

      <TouchableOpacity style={s.fab} onPress={() => { setEditing(null); setFormOpen(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <RuleFormModal
        visible={formOpen}
        rule={editing}
        pipelines={pipelines}
        users={users}
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
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  sectionTitle: {
    fontSize: 12, fontWeight: "800", color: "#0f766e", letterSpacing: 0.6,
    textTransform: "uppercase", marginTop: 6,
  },
  errorBox: { backgroundColor: "#fef2f2", borderRadius: 12, padding: 12 },
  errorText: { color: "#dc2626", fontSize: 13 },
  field: { gap: 6 },
  label: {
    fontSize: 12.5, fontWeight: "600", color: "#6b7280",
    fontFamily: fontMedium,
  },
  hint: {
    fontSize: 12, color: "#92400e", backgroundColor: "#fffbeb",
    borderRadius: 10, padding: 10, lineHeight: 17,
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
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.12)",
  },
  checkTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  checkSub: { fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 17 },
  aiCard: {
    backgroundColor: "#eef2ff", borderRadius: 12, padding: 14, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: "#c7d2fe",
  },
  aiTitle: { fontSize: 14, fontWeight: "800", color: "#312e81" },
  aiBody: { fontSize: 13, color: "#3730a3", lineHeight: 19 },
  aiWarn: { fontSize: 12, color: "#92400e", backgroundColor: "#fffbeb", borderRadius: 8, padding: 8, lineHeight: 16 },
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
