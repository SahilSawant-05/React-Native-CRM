import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { Ionicons } from "@expo/vector-icons";

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;

// Web parity (config/leadSources.js leadSourceLabel): friendly label for a
// lead source code, e.g. "FACEBOOK" → "Facebook", "WEBSITE_FORM" → "Website Form".
const LEAD_SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "Email", WEBSITE_FORM: "Website Form", WEBSITE: "Website",
  WEB: "Website", FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GOOGLE_ADS: "Google Ads",
  REFERRAL: "Referral", WALK_IN: "Walk-in", PORTAL: "Portal", CAMPAIGN: "Campaign",
  CSV_IMPORT: "CSV / Excel Import", IMPORT: "CSV / Excel Import", CSV: "CSV / Excel Import",
  UPLOAD: "CSV / Excel Import", MANUAL: "Manual", OTHER: "Other",
};
function leadSourceLabel(value?: string | null): string {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "";
  return LEAD_SOURCE_LABELS[normalized] || normalized.replace(/_/g, " ");
}

// Web parity (Contacts.jsx normTags): tags may arrive as an array or a
// comma-separated string; normalize to a clean string array.
function normTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
import { RouteProp } from "@react-navigation/native";
import { fetchContactById, fetchContactTimeline, updateContact, deleteContact } from "../../api/contacts";
import { emailValidationMessage, phoneValidationMessage } from "../../utils/validation";
import { Contact } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { DrawerCtx } from "../../navigation/AdminDrawer";
import { AgentDrawerCtx } from "../../navigation/AgentDrawer";
import { smartCall } from "../../api/telephony";
import AiAssistPanel from "../../components/ai/AiAssistPanel";
import api from "../../api/client";
import { CalendarSheet } from "../tasks/TasksScreen";

// ─── Create Task modal (web parity: ainew TaskModal.jsx) ─────────────────────
function CreateTaskModal({
  visible, contact, onClose, onCreated,
}: {
  visible: boolean;
  contact: Contact;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTitle(""); setDescription(""); setAssignedUserId(""); setDueAt(null); setError("");
    api.get("/api/users")
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : res.data?.data ?? res.data?.users ?? [];
        setUsers(rows);
      })
      .catch(() => setUsers([]));
  }, [visible]);

  async function create() {
    if (saving) return;
    if (!title.trim()) { setError("Task title is required."); return; }
    if (!dueAt) { setError("Due date and time is required."); return; }
    setSaving(true);
    setError("");
    try {
      const contactId = contact.id ?? contact._id;
      await api.post(`/api/contacts/${contactId}/tasks`, {
        title: title.trim(),
        description: description.trim(),
        assignedUserId: assignedUserId ? Number(assignedUserId) : null,
        dueAt: dueAt.toISOString(),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.status === 403
          ? "You do not have permission to create a task for this contact."
          : err?.response?.data?.message || err?.message || "Failed to create task."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={tm.header}>
          <View>
            <Text style={tm.title}>Create Task</Text>
            <Text style={tm.subtitle}>{contact.name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={tm.body} keyboardShouldPersistTaps="handled">
            {!!error && <View style={tm.errorBox}><Text style={tm.errorText}>{error}</Text></View>}

            <Text style={tm.label}>Task title *</Text>
            <TextInput
              style={tm.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Call to discuss pricing"
              placeholderTextColor="#9ca3af"
            />

            <Text style={tm.label}>Description</Text>
            <TextInput
              style={[tm.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What needs to be done?"
              placeholderTextColor="#9ca3af"
              multiline
            />

            <Text style={tm.label}>Due date & time *</Text>
            <TouchableOpacity style={tm.dateField} onPress={() => setCalendarOpen(true)} activeOpacity={0.7}>
              <Text style={[tm.dateFieldText, !dueAt && { color: "#9ca3af" }]}>
                {dueAt ? dueAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Select date & time"}
              </Text>
              <Ionicons name="calendar-outline" size={17} color="#0f766e" />
            </TouchableOpacity>

            {users.length > 0 && (
              <>
                <Text style={tm.label}>Assign to</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                  {[{ id: "", email: "Unassigned" }, ...users].map((u: any) => {
                    const active = assignedUserId === String(u.id);
                    return (
                      <TouchableOpacity
                        key={u.id === "" ? "unassigned" : String(u.id)}
                        style={[tm.chip, active && tm.chipActive]}
                        onPress={() => setAssignedUserId(String(u.id))}
                      >
                        <Text style={[tm.chipText, active && tm.chipTextActive]}>{u.email || u.name || `User #${u.id}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </ScrollView>
          <View style={tm.footer}>
            <TouchableOpacity style={[tm.createBtn, saving && { opacity: 0.6 }]} onPress={create} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={tm.createBtnText}>Create Task</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <CalendarSheet
          visible={calendarOpen}
          initial={dueAt}
          onCancel={() => setCalendarOpen(false)}
          onConfirm={(d) => { setDueAt(d); setCalendarOpen(false); }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const tm = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14, backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.15)",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111827", fontFamily: mediumFont },
  subtitle: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  body: { padding: 16, gap: 8, paddingBottom: 120 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", fontFamily: mediumFont, marginTop: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#111827", backgroundColor: "#fff",
  },
  dateField: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff",
  },
  dateFieldText: { fontSize: 14.5, color: "#111827" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: "rgba(118,118,128,0.08)" },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 12.5, fontWeight: "600", color: "#4b5563" },
  chipTextActive: { color: "#fff" },
  errorBox: { backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 12, padding: 12 },
  errorText: { color: "#dc2626", fontSize: 13 },
  footer: {
    padding: 14, backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.15)",
  },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#0f766e", borderRadius: 12, minHeight: 48,
  },
  createBtnText: { fontSize: 15, fontWeight: "600", color: "#fff", fontFamily: mediumFont },
});

// ─── Edit Contact modal (web parity: PUT /api/contacts/{id}) ─────────────────
function EditContactModal({
  visible, contact, onClose, onSaved,
}: {
  visible: boolean;
  contact: Contact;
  onClose: () => void;
  onSaved: (updated: Contact) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setName(contact.name || "");
    setEmail(contact.email || "");
    setPhone(contact.phone || "");
    setCompany((contact as any).company || "");
    setStatus(contact.status || "");
    setTags(Array.isArray(contact.tags) ? (contact.tags as any[]).join(", ") : String(contact.tags || ""));
    setError("");
  }, [visible, contact]);

  async function save() {
    if (saving) return;
    if (!name.trim()) { setError("Name is required."); return; }
    const emailErr = emailValidationMessage(email);
    if (emailErr) { setError(emailErr); return; }
    const phoneErr = phoneValidationMessage(phone);
    if (phoneErr) { setError(phoneErr); return; }
    setSaving(true);
    setError("");
    try {
      // Mirror the web EditContact/handleUpdateContact flow exactly: PUT the
      // FULL contact object (original spread first so id and untouched fields
      // are preserved) with tags kept as the raw comma string the backend
      // expects. Sending a partial body makes the PUT endpoint blank fields
      // or reject the request.
      const { id, _id, ...rest } = contact as any;
      const payload: any = {
        ...rest,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        status: status.trim() || contact.status,
        tags: tags.trim(),
      };
      const contactId = contact.id ?? contact._id ?? "";
      const updated = await updateContact(contactId, payload);
      onSaved({ ...contact, ...payload, ...(updated || {}) });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fb" }}>
        <View style={tm.header}>
          <Text style={tm.title}>Edit Contact</Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={tm.body} keyboardShouldPersistTaps="handled">
            {!!error && <View style={tm.errorBox}><Text style={tm.errorText}>{error}</Text></View>}
            <Text style={tm.label}>Name *</Text>
            <TextInput style={tm.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9ca3af" />
            <Text style={tm.label}>Phone</Text>
            <TextInput style={tm.input} value={phone} onChangeText={setPhone} placeholder="+91…" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
            <Text style={tm.label}>Email</Text>
            <TextInput style={tm.input} value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
            <Text style={tm.label}>Company</Text>
            <TextInput style={tm.input} value={company} onChangeText={setCompany} placeholder="Company" placeholderTextColor="#9ca3af" />
            <Text style={tm.label}>Status</Text>
            <TextInput style={tm.input} value={status} onChangeText={setStatus} placeholder="e.g. NEW, QUALIFIED" placeholderTextColor="#9ca3af" autoCapitalize="characters" />
            <Text style={tm.label}>Tags (comma-separated)</Text>
            <TextInput style={tm.input} value={tags} onChangeText={setTags} placeholder="hot, referral" placeholderTextColor="#9ca3af" autoCapitalize="none" />
          </ScrollView>
          <View style={tm.footer}>
            <TouchableOpacity style={[tm.createBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="checkmark" size={17} color="#fff" />
                  <Text style={tm.createBtnText}>Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

type Props = {
  route: RouteProp<{ ContactDetail: { contact: Contact } }, "ContactDetail">;
  navigation?: any;
};

export default function ContactDetailScreen({ route, navigation }: Props) {
  const initial = route.params.contact;
  const [contact, setContact] = useState<Contact>(initial);
  // Works in both admin (DrawerCtx) and agent (AgentDrawerCtx) contexts
  const adminDrawer = useContext(DrawerCtx);
  const agentDrawer = useContext(AgentDrawerCtx);
  function navigateToTab(tab: string) {
    adminDrawer.navigateTo(tab);
    agentDrawer.navigateTo(tab);
  }
  function openContactChat() {
    const pending = { contactId: contact.id ?? contact._id ?? "", contactName: contact.name, contactPhone: contact.phone };
    adminDrawer.openChat(pending);
    agentDrawer.openChat(pending);
  }
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callPlacing, setCallPlacing] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskNotice, setTaskNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  function confirmDelete() {
    Alert.alert("Delete Contact", `Delete "${contact.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteContact(contact.id ?? contact._id ?? "");
            // Go back to the contacts list after delete
            if (navigation?.goBack) navigation.goBack();
            else navigateToTab("Contacts");
          } catch (err: any) {
            Alert.alert("Delete failed", err?.response?.data?.message || err?.message || "Could not delete contact.");
          }
        },
      },
    ]);
  }

  function handleTaskCreated() {
    setTaskNotice("Task created for this contact.");
    setTimeout(() => setTaskNotice(""), 3000);
    // Refresh the timeline so the new task shows in Recent Activity
    fetchContactTimeline(contact.id ?? contact._id ?? "")
      .then((tl) => setTimeline(tl ?? []))
      .catch(() => {});
  }

  // Toggle-aware calling: CRM click-to-call when telephony is active +
  // click-to-call enabled, otherwise the phone's native dialer.
  async function handleCall() {
    if (callPlacing || !contact.phone) return;
    setCallPlacing(true);
    try {
      const result = await smartCall({
        contactId: contact.id ?? contact._id ?? null,
        phone: contact.phone,
      });
      if (result.mode === "CRM") {
        Alert.alert(
          "CRM call started",
          `Call logged as ${result.status}. Your phone will ring first, then the customer is connected.`
        );
      } else if (result.failureReason) {
        // CRM was on but couldn't start — we already fell back to the dialer.
        Alert.alert("Called via phone", `CRM call failed (${result.failureReason}), dialed normally instead.`);
      }
    } finally {
      setCallPlacing(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const contactId = initial.id ?? initial._id ?? "";
        const [full, tl] = await Promise.all([
          fetchContactById(contactId),
          fetchContactTimeline(contactId),
        ]);
        setContact(full);
        setTimeline(tl ?? []);
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || "Failed to load contact");
      } finally {
        setLoading(false);
      }
    })();
  }, [initial.id]);

  if (loading) return <LoadingSpinner message="Loading contact…" />;

  const initials = (contact.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // tags may arrive as a comma-separated string or non-array — normalise
  // tags may arrive as a comma-separated string or non-array — normalise
let tags: string[] = [];
try {
  if (Array.isArray(contact.tags)) {
    tags = (contact.tags as any[]).map((t) => String(t).trim()).filter((t) => t.length > 0);
  } else if (contact.tags) {
    tags = String(contact.tags).split(",").map((t) => t.trim()).filter((t) => t.length > 0);
  }
} catch {
  tags = [];
}

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!!error && <ErrorBanner message={error} />}

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <View key={`tag-${i}-${tag}`} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Edit / Delete (web parity: PUT / DELETE /api/contacts/{id}) */}
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroEditBtn} onPress={() => setEditOpen(true)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={15} color="#0f766e" />
              <Text style={styles.heroEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroDeleteBtn} onPress={confirmDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={15} color="#dc2626" />
              <Text style={styles.heroDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {!!contact.phone && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCall}
              disabled={callPlacing}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#dcfce7" }]}>
                {callPlacing ? (
                  <ActivityIndicator size="small" color="#15803d" />
                ) : (
                  <Ionicons name="call" size={22} color="#15803d" />
                )}
              </View>
              <Text style={[styles.actionLabel, { color: "#15803d" }]}>Call</Text>
            </TouchableOpacity>
          )}
          {/* WhatsApp → opens CRM Chat for this specific contact */}
          {!!contact.phone && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={openContactChat}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#ccfbf1" }]}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#0f766e" />
              </View>
              <Text style={[styles.actionLabel, { color: "#0f766e" }]}>Chat</Text>
            </TouchableOpacity>
          )}
          {/* Email → opens CRM Mail (not phone mail app) */}
          {!!contact.email && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigateToTab("Mail")}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="mail" size={22} color="#1d4ed8" />
              </View>
              <Text style={[styles.actionLabel, { color: "#1d4ed8" }]}>Mail</Text>
            </TouchableOpacity>
          )}
          {/* Create Task (web parity: TaskModal from contact) */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setTaskModalOpen(true)}
          >
            <View style={[styles.actionCircle, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="checkbox" size={22} color="#b45309" />
            </View>
            <Text style={[styles.actionLabel, { color: "#b45309" }]}>Task</Text>
          </TouchableOpacity>
        </View>

        {!!taskNotice && (
          <View style={styles.taskNotice}>
            <Ionicons name="checkmark-circle" size={15} color="#047857" />
            <Text style={styles.taskNoticeText}>{taskNotice}</Text>
          </View>
        )}

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Info</Text>
          {[
            { label: "Phone", value: contact.phone },
            { label: "Email", value: contact.email },
            { label: "Company", value: (contact as any).company },
            { label: "Source", value: leadSourceLabel((contact as any).leadSource) },
            // Web parity (Contacts.jsx Info: "Source Detail" = leadSourceDetail).
            // For Facebook/Instagram lead-ad contacts this holds the form/site
            // the lead came in against, so label it "Lead Form" in that case.
            {
              label: /FACEBOOK|INSTAGRAM|META/i.test(String((contact as any).leadSource || ""))
                ? "Lead Form"
                : "Source Detail",
              value: (contact as any).leadSourceDetail || (contact as any).sourceDetail,
            },
            { label: "City", value: (contact as any).city },
            { label: "Status", value: contact.status },
            { label: "Created", value: contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : null },
          ]
            .filter((f) => !!f.value)
            .map((f) => (
              <View key={f.label} style={styles.field}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldValue}>{f.value}</Text>
              </View>
            ))}
          {/* Tags (web parity: Contacts.jsx Info "Tags" pills). */}
          {(() => {
            const tags = normTags((contact as any).tags);
            if (tags.length === 0) return null;
            return (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tags</Text>
                <View style={styles.tagRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            {[...timeline]
              .sort((a, b) => new Date(b.occurredAt || b.createdAt || 0).getTime() - new Date(a.occurredAt || a.createdAt || 0).getTime())
              .slice(0, 10)
              .map((item, i) => {
                // Web parity (Contacts.jsx recent activity): the timeline API
                // uses itemType/title/description/textBody/occurredAt — the
                // old render read `type`/`createdAt` and showed bare
                // "Activity" rows with no detail.
                const itemType = String(item.itemType || item.type || "ACTIVITY");
                const typeLabel = itemType.replace(/_/g, " ");
                const headline = item.title || item.description || item.textBody || item.eventType || typeLabel;
                const detail = item.title ? (item.description || item.textBody) : (item.description && item.textBody ? item.textBody : null);
                const when = item.occurredAt || item.createdAt;
                const isCall = itemType === "CALL";
                const callMeta = isCall
                  ? [item.direction, item.status, item.disposition, item.durationSeconds ? `${item.durationSeconds}s` : null]
                      .filter(Boolean)
                      .map((v) => String(v).replace(/_/g, " ").toLowerCase())
                      .join(" • ")
                  : "";
                return (
                  <View key={`tl-${i}-${item.messageId ?? item.emailId ?? item.taskId ?? item.noteId ?? item.callLogId ?? item.appointmentId ?? when ?? i}`} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineType}>{typeLabel}</Text>
                      <Text style={styles.timelineHeadline} numberOfLines={2}>{headline}</Text>
                      {!!detail && (
                        <Text style={styles.timelineDesc} numberOfLines={3}>{detail}</Text>
                      )}
                      {!!callMeta && <Text style={styles.timelineDesc}>{callMeta}</Text>}
                      {!!when && (
                        <Text style={styles.timelineDate}>
                          {new Date(when).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        {/* AI Assistant — summary + suggested reply for this contact */}
        <View style={styles.card}>
          <AiAssistPanel
            contactId={contact.id ?? contact._id ?? null}
            title="AI Assistant"
            contextPrompt={
              `Contact: ${contact.name || ""}${contact.phone ? ` (${contact.phone})` : ""}.\n` +
              `Status: ${contact.status || "N/A"}.\n` +
              `Summarise this contact's CRM history and recommend the next best action.`
            }
            replyPrompt={
              `Contact: ${contact.name || ""}.\n` +
              `Write a short, warm follow-up message for this contact to move the conversation forward.`
            }
          />
        </View>
      </ScrollView>

      <EditContactModal
        visible={editOpen}
        contact={contact}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setContact(updated)}
      />

      <CreateTaskModal
        visible={taskModalOpen}
        contact={contact}
        onClose={() => setTaskModalOpen(false)}
        onCreated={handleTaskCreated}
      />
    </SafeAreaView>
  );
}

const iosTight = Platform.OS === "ios" ? -0.32 : undefined;
const iosTightSm = Platform.OS === "ios" ? -0.15 : undefined;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { gap: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#0f766e",
    fontFamily: mediumFont,
  },
  name: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    fontFamily: mediumFont,
    letterSpacing: iosTight,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  heroEditBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(15,118,110,0.08)", borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  heroEditText: { fontSize: 13, fontWeight: "600", color: "#0f766e", fontFamily: mediumFont },
  heroDeleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(220,38,38,0.06)", borderRadius: 99,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  heroDeleteText: { fontSize: 13, fontWeight: "600", color: "#dc2626", fontFamily: mediumFont },
  tag: {
    backgroundColor: "rgba(15,118,110,0.08)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, color: "#0f766e", fontWeight: "600", fontFamily: mediumFont },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: 16,
    gap: 28,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    minWidth: 56,
    minHeight: 44,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    fontFamily: mediumFont,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    fontFamily: mediumFont,
  },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  fieldLabel: { fontSize: 12, color: "#6b7280", fontWeight: "500", letterSpacing: iosTightSm },
  tagRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, marginLeft: 12 },
  fieldValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    fontFamily: mediumFont,
    maxWidth: "60%",
    textAlign: "right",
    letterSpacing: iosTightSm,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f766e",
    marginTop: 5,
  },
  timelineContent: { flex: 1, gap: 2 },
  taskNotice: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#ecfdf5", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginTop: 10,
  },
  taskNoticeText: { flex: 1, fontSize: 12.5, color: "#047857", fontWeight: "600" },
  timelineType: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0f766e",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  timelineHeadline: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    fontFamily: mediumFont,
    letterSpacing: iosTightSm,
  },
  timelineDesc: { fontSize: 12.5, color: "#374151" },
  timelineDate: { fontSize: 11.5, color: "#9ca3af" },
});