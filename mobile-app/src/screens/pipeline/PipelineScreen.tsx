import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  TextInput,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  contactId?: number | null;
  pipelineId?: number | string | null;
  pipelineName?: string;
  ownerUserId?: string;
  title: string;
  contactName?: string;
  contactPhone?: string;
  contactLeadSource?: string;
  contactLeadSourceDetail?: string;
  amount?: number | null;
  expectedRevenue?: number | null;
  probability?: number | null;
  priority?: string;
  lostReason?: string;
  activitySlaHours?: number | null;
  activitySlaDueAt?: string;
  activitySlaBreached?: boolean;
  source?: string;
  notes?: string;
  detailsJson?: string;
  industryKey?: string;
  domainItemId?: number | null;
  domainItemName?: string;
  expectedCloseDate?: string;
  stage: string;
  updatedAt?: string;
}

interface StageMeta {
  key: string;
  label: string;
  color: string;
  icon: string;
}

interface Pipeline {
  id: string | number;
  name: string;
  defaultPipeline?: boolean;
  industryKey?: string;
}

interface Contact {
  id: string | number;
  name: string;
  phone?: string;
}

interface DomainItem {
  id: string | number;
  name: string;
  category?: string;
  price?: number;
  industryKey?: string;
}

// ─── Font helpers ─────────────────────────────────────────────────────────────
const FONT_MED = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const LS_LG = Platform.OS === "ios" ? -0.32 : 0; // 15-16pt
const LS_SM = Platform.OS === "ios" ? -0.15 : 0; // 13-14pt

// ─── Constants ────────────────────────────────────────────────────────────────
const FALLBACK_STAGES: StageMeta[] = [
  { key: "NEW",       label: "New",       color: "#0f766e", icon: "sparkles-outline" },
  { key: "QUALIFIED", label: "Qualified", color: "#2563eb", icon: "checkmark-circle-outline" },
  { key: "FOLLOW_UP", label: "Follow Up", color: "#7c3aed", icon: "calendar-outline" },
  { key: "WON",       label: "Won",       color: "#059669", icon: "trophy-outline" },
  { key: "LOST",      label: "Lost",      color: "#dc2626", icon: "close-circle-outline" },
];

const PALETTE = ["#0f766e","#2563eb","#7c3aed","#d97706","#059669","#dc2626","#0891b2"];
const ICONS   = ["sparkles-outline","checkmark-circle-outline","calendar-outline","search-outline","clipboard-outline","people-outline","trophy-outline","close-circle-outline"];
const STALE_DAYS = 3;
const OPPORTUNITY_PAGE_SIZE = 100;
const { width: SW, height: SH } = Dimensions.get("window");
const COL_W = SW * 0.78;

// Height of the fixed header bar rendered above the KeyboardAvoidingView in the
// Add/Edit modal. Used as the iOS keyboardVerticalOffset so the padding math
// accounts for that header instead of overshooting/undershooting and clipping
// the Save button or the chip rows.
const MODAL_HEADER_HEIGHT = 56;

// ─── Helpers ────────────────────────────────────────────────────────────────
function normalizeList(data: any): any[] {
  if (Array.isArray(data))          return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items))   return data.items;
  if (Array.isArray(data?.data))    return data.data;
  return [];
}

function normalizeStageKey(value?: string): string {
  return String(value || "NEW").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function buildStagesMeta(keys: string[]): StageMeta[] {
  return keys.map((key, i) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    color: key === "WON"  ? "#059669" : key === "LOST" ? "#dc2626" : PALETTE[i % PALETTE.length],
    icon: key === "WON"  ? "trophy-outline" : key === "LOST" ? "close-circle-outline" : ICONS[i % ICONS.length],
  }));
}

function buildStages(rawStages: any[]): StageMeta[] {
  const source = rawStages?.length ? rawStages : FALLBACK_STAGES;
  return source
    .filter(s => s.active !== false)
    .sort((a, b) => (a.displayOrder ?? 100) - (b.displayOrder ?? 100))
    .map((s, i) => {
      const key = normalizeStageKey(s.stageKey || s.key || s.label);
      return {
        key,
        label: s.label || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        color: key === "WON"  ? "#059669" : key === "LOST" ? "#dc2626" : PALETTE[i % PALETTE.length],
        icon: key === "WON"  ? "trophy-outline" : key === "LOST" ? "close-circle-outline" : ICONS[i % ICONS.length],
      };
    });
}

function toCard(o: any, stages: StageMeta[]): Opportunity {
  const stageKeys = new Set(stages.map(s => s.key));
  const firstStage = stages[0]?.key || "NEW";
  const stage = normalizeStageKey(o.stage || firstStage);
  return {
    id: String(o.id),
    contactId: o.contactId ?? null,
    pipelineId: o.pipelineId ?? null,
    pipelineName: o.pipelineName || "",
    ownerUserId: o.ownerUserId || "",
    title: o.title || "Untitled Opportunity",
    contactName: o.contactName || "",
    contactPhone: o.contactPhone || "",
    contactLeadSource: o.contactLeadSource || "",
    contactLeadSourceDetail: o.contactLeadSourceDetail || "",
    amount: o.amount ?? null,
    expectedRevenue: o.expectedRevenue ?? null,
    probability: o.probability ?? null,
    priority: o.priority || "MEDIUM",
    lostReason: o.lostReason || "",
    activitySlaHours: o.activitySlaHours ?? null,
    activitySlaDueAt: o.activitySlaDueAt || "",
    activitySlaBreached: Boolean(o.activitySlaBreached),
    source: o.source || "",
    notes: o.notes || "",
    detailsJson: o.detailsJson || "",
    industryKey: o.industryKey || "",
    domainItemId: o.domainItemId ?? null,
    domainItemName: o.domainItemName || "",
    expectedCloseDate: o.expectedCloseDate || "",
    stage: stageKeys.has(stage) ? stage : firstStage,
    updatedAt: o.updatedAt || o.createdAt || "",
  };
}

function formatCurrency(n?: number | null): string {
  if (n == null || isNaN(Number(n))) return "";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatDate(raw?: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isStaleCard(opp: Opportunity): boolean {
  if (!opp.updatedAt) return false;
  const updated = new Date(opp.updatedAt);
  if (isNaN(updated.getTime())) return false;
  return updated < new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: "#fef2f2", text: "#b91c1c" },
  HIGH:   { bg: "#fff7ed", text: "#c2410c" },
  MEDIUM: { bg: "#fffbeb", text: "#b45309" },
  LOW:    { bg: "#f3f4f6", text: "#6b7280" },
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }, []);

  const bg = type === "error" ? "#fef2f2" : type === "info"  ? "#eff6ff" : "#f0fdf4";
  const border = type === "error" ? "#fca5a5" : type === "info"  ? "#93c5fd" : "#86efac";
  const textColor = type === "error" ? "#dc2626" : type === "info"  ? "#2563eb" : "#16a34a";

  return (
    <Animated.View style={[ts.wrap, { backgroundColor: bg, borderColor: border, opacity: anim }]}>
      <Text style={[ts.text, { color: textColor }]}>{message}</Text>
    </Animated.View>
  );
}

const ts = StyleSheet.create({
  wrap: { position: "absolute", bottom: 24, left: 16, right: 16, zIndex: 9999, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 },
  text: { fontSize: 13, fontWeight: "600", fontFamily: FONT_MED, letterSpacing: LS_SM },
});

// ─── Lost Reason Modal ──────────────────────────────────────────────────────
function LostReasonModal({ visible, onConfirm, onCancel }: {
  visible: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={lms.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={lms.kav}
          keyboardVerticalOffset={0}
        >
          <View style={lms.sheet}>
            <Text style={lms.title}>Reason for Loss</Text>
            <Text style={lms.sub}>Describe why this opportunity was lost</Text>
            <TextInput
              style={lms.input}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Budget constraints, competitor chosen..."
              placeholderTextColor="#94a3b8"
              multiline
              autoFocus
            />
            <View style={lms.btnRow}>
              <TouchableOpacity style={lms.cancelBtn} onPress={onCancel}>
                <Text style={lms.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={lms.confirmBtn}
                onPress={() => { onConfirm(reason.trim()); setReason(""); }}
              >
                <Text style={lms.confirmText}>Mark Lost</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const lms = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  kav:        { width: "100%" },
  sheet:      { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:      { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 4, fontFamily: FONT_MED, letterSpacing: LS_LG },
  sub:        { fontSize: 13, color: "#6b7280", marginBottom: 16, letterSpacing: LS_SM },
  input:      { backgroundColor: "#f8f9fb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, fontSize: 14, color: "#374151", minHeight: 90, textAlignVertical: "top", marginBottom: 16 },
  btnRow:     { flexDirection: "row", gap: 10 },
  cancelBtn:  { flex: 1, paddingVertical: 13, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "#f3f4f6" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#6b7280", fontFamily: FONT_MED, letterSpacing: LS_SM },
  confirmBtn: { flex: 1, paddingVertical: 13, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, backgroundColor: "#dc2626" },
  confirmText:{ fontSize: 14, fontWeight: "600", color: "#fff", fontFamily: FONT_MED, letterSpacing: LS_SM },
});

// ─── Contact Picker ───────────────────────────────────────────────────────────
// NOTE: this is intentionally NOT a <Modal>. It renders as an absolutely
// positioned overlay inside the same native window as the Add/Edit modal.
// Two stacked <Modal> components (this one used to be a second Modal on top
// of the Add/Edit Modal) is what broke keyboard resize behavior, especially
// on Android — each Modal is its own native window, so the OS can only
// correctly resize/track the keyboard against one of them, and the two
// windows fight over it. An overlay has no window of its own, so there's
// only ever one place the keyboard listener has to push content up.
function ContactPickerModal({ visible, contacts, selectedId, onSelect, onClose }: {
  visible: boolean;
  contacts: Contact[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => { if (visible) setQuery(""); }, [visible]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, e => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      c => c.name?.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q)
    );
  }, [contacts, query]);

  if (!visible) return null;

  // Available height above the keyboard (with a small safety margin), capped
  // so the sheet never grows taller than it would with no keyboard shown.
  const maxSheetHeight = keyboardHeight > 0 ? Math.max(260, SH - keyboardHeight - 24) : SH * 0.7;

  return (
    <View style={cp.overlayAbsolute} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[cp.sheet, { maxHeight: maxSheetHeight, marginBottom: keyboardHeight }]}>
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          keyboardShouldPersistTaps="handled"
          style={cp.list}
          contentContainerStyle={cp.listContent}
          stickyHeaderIndices={[0]}
          ListHeaderComponent={
            <View style={cp.stickyHeader}>
              <View style={cp.header}>
                <Text style={cp.title}>Select Contact</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={cp.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={cp.searchWrap}>
                <TextInput
                  style={cp.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name or phone..."
                  placeholderTextColor="#94a3b8"
                  autoFocus
                  clearButtonMode="while-editing"
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={cp.empty}>
              <Text style={cp.emptyText}>No contacts match "{query}"</Text>
            </View>
          }
          renderItem={({ item }) => {
            const active = String(item.id) === String(selectedId);
            return (
              <TouchableOpacity
                style={[cp.row, active && cp.rowActive]}
                onPress={() => { onSelect(String(item.id)); onClose(); }}
              >
                <View style={cp.avatar}>
                  <Text style={cp.avatarText}>{(item.name || "?").trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={cp.rowName} numberOfLines={1}>{item.name}</Text>
                  {!!item.phone && <Text style={cp.rowPhone} numberOfLines={1}>{item.phone}</Text>}
                </View>
                {active && <Ionicons name="checkmark" size={18} color="#0f766e" />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const cp = StyleSheet.create({
  overlayAbsolute: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 9999, elevation: 50 },
  sheet:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  stickyHeader:{ backgroundColor: "#fff", paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 14 },
  title:       { fontSize: 16, fontWeight: "600", color: "#111827", fontFamily: FONT_MED, letterSpacing: LS_LG },
  doneText:    { fontSize: 14, fontWeight: "600", color: "#0f766e", fontFamily: FONT_MED, letterSpacing: LS_SM },
  searchWrap:  { paddingHorizontal: 24 },
  searchInput: { backgroundColor: "#f8f9fb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#374151" },
  list:        { flexGrow: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, minHeight: 48, paddingHorizontal: 10, borderRadius: 12 },
  rowActive:   { backgroundColor: "#f0fdf4" },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0f766e14", alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 14, fontWeight: "600", color: "#0f766e", fontFamily: FONT_MED },
  rowName:     { fontSize: 14, fontWeight: "600", color: "#111827", fontFamily: FONT_MED, letterSpacing: LS_SM },
  rowPhone:    { fontSize: 12, color: "#6b7280", marginTop: 1 },
  empty:       { paddingVertical: 40, alignItems: "center" },
  emptyText:   { fontSize: 13, color: "#9ca3af", fontWeight: "600", letterSpacing: LS_SM },
});

// ─── Add / Edit Modal ───────────────────────────────────────────────────────
interface OppFormState {
  contactId: string;
  title: string;
  stage: string;
  amount: string;
  expectedCloseDate: string;
  priority: string;
  probability: string;
  lostReason: string;
  source: string;
  notes: string;
}

function OpportunityModal({ open, stages, contacts, initial, defaultStage, saving, onClose, onSave }: {
  open: boolean;
  stages: StageMeta[];
  contacts: Contact[];
  initial: Opportunity | null;
  defaultStage: string;
  saving: boolean;
  onClose: () => void;
  onSave: (form: OppFormState) => void;
}) {
  const [form, setForm] = useState<OppFormState>({
    contactId: "", title: "", stage: defaultStage, amount: "", expectedCloseDate: "",
    priority: "MEDIUM", probability: "", lostReason: "", source: "", notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      contactId: String(initial?.contactId || contacts[0]?.id || ""),
      title: initial?.title || "",
      stage: initial?.stage || defaultStage || stages[0]?.key || "NEW",
      amount: initial?.amount != null ? String(initial.amount) : "",
      expectedCloseDate: initial?.expectedCloseDate || "",
      priority: initial?.priority || "MEDIUM",
      probability: initial?.probability != null ? String(initial.probability) : "",
      lostReason: initial?.lostReason || "",
      source: initial?.source || "",
      notes: initial?.notes || "",
    });
  }, [open, initial, defaultStage]);

  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  if (!open) return null;

  const set = (key: keyof OppFormState, val: string) => setForm(f => ({ ...f, [key]: val }));
  const selectedContact = contacts.find(c => String(c.id) === form.contactId) || null;

  const submit = () => {
    if (!form.contactId || !form.title.trim()) {
      Alert.alert("Required", "Contact and title are required.");
      return;
    }
    if (normalizeStageKey(form.stage) === "LOST" && !form.lostReason.trim()) {
      Alert.alert("Required", "Lost reason is required before marking as Lost.");
      return;
    }
    onSave(form);
  };

  const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  // NOTE: intentionally NOT a <Modal>. On Android, RN's <Modal> renders as a
  // native Dialog with its own windowSoftInputMode, which cannot be set from
  // JS — no amount of KeyboardAvoidingView/KeyboardAwareScrollView tuning can
  // fix a Dialog that Android itself won't resize for the keyboard. Rendering
  // this as a plain absolutely-positioned overlay makes it part of the host
  // Activity's own window instead, which DOES correctly resize/pan with the
  // keyboard (governed by the app's AndroidManifest windowSoftInputMode /
  // Expo's app.json android.softwareKeyboardLayoutMode).
  return (
    <View style={om.overlayRoot} pointerEvents="box-none">
      <SafeAreaView edges={["top", "bottom"]} style={om.root}>
        {/* Header — stays fixed above the scroll view so it's never covered or
            pushed out of view when the keyboard opens */}
        <View style={om.header}>
          <TouchableOpacity onPress={onClose} style={om.closeBtn}>
            <Text style={om.closeText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={om.title}>{initial ? "Edit Opportunity" : "Add Opportunity"}</Text>
          <TouchableOpacity onPress={submit} disabled={saving} style={om.saveBtn}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={om.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Plain ScrollView with generous bottom padding — you can always
            manually scroll a field (e.g. Notes, Source) clear of the
            keyboard, regardless of whether Android resizes the window. This
            is deliberately simple: no auto-scroll-to-focused-input library,
            just room to scroll. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? MODAL_HEADER_HEIGHT : 0}
        >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={om.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Contact — searchable selector instead of a chip slider */}
          <Text style={om.label}>Contact</Text>
          <TouchableOpacity
            style={om.selectBox}
            onPress={() => setContactPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[om.selectText, !selectedContact && om.selectPlaceholder]}
              numberOfLines={1}
            >
              {selectedContact
                ? `${selectedContact.name}${selectedContact.phone ? ` (${selectedContact.phone})` : ""}`
                : "Select a contact"}
            </Text>
            <Text style={om.selectChevron}>▾</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={om.label}>Title *</Text>
          <TextInput
            style={om.input}
            value={form.title}
            onChangeText={v => set("title", v)}
            placeholder="Opportunity title"
            placeholderTextColor="#94a3b8"
          />

          {/* Stage */}
          <Text style={om.label}>Stage</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={om.chipScroll}>
            {stages.map(st => {
              const active = form.stage === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => set("stage", st.key)}
                  style={[om.chip, active && { backgroundColor: st.color, borderColor: st.color }]}
                >
                  <Text style={[om.chipText, active && om.chipTextActive]}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {normalizeStageKey(form.stage) === "LOST" && (
            <>
              <Text style={om.label}>Lost Reason *</Text>
              <TextInput
                style={[om.input, { minHeight: 70, textAlignVertical: "top" }]}
                value={form.lostReason}
                onChangeText={v => set("lostReason", v)}
                placeholder="Budget, no response, competitor..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </>
          )}

          {/* Priority */}
          <Text style={om.label}>Priority</Text>
          <View style={om.row}>
            {PRIORITIES.map(p => {
              const active = form.priority === p;
              const pc = PRIORITY_COLORS[p];
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => set("priority", p)}
                  style={[om.priorityChip, active && { backgroundColor: pc.bg, borderColor: pc.text }]}
                >
                  <Text style={[om.priorityText, active && { color: pc.text }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={om.label}>Amount (₹)</Text>
          <TextInput
            style={om.input}
            value={form.amount}
            onChangeText={v => set("amount", v)}
            placeholder="0"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />

          {/* Probability */}
          <Text style={om.label}>Probability %</Text>
          <TextInput
            style={om.input}
            value={form.probability}
            onChangeText={v => set("probability", v)}
            placeholder="0–100"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
          />

          {/* Expected Close */}
          <Text style={om.label}>Expected Close Date (YYYY-MM-DD)</Text>
          <TextInput
            style={om.input}
            value={form.expectedCloseDate}
            onChangeText={v => set("expectedCloseDate", v)}
            placeholder="2025-12-31"
            placeholderTextColor="#94a3b8"
          />

          {/* Source */}
          <Text style={om.label}>Source</Text>
          <TextInput
            style={om.input}
            value={form.source}
            onChangeText={v => set("source", v)}
            placeholder="Website, Referral, Cold call..."
            placeholderTextColor="#94a3b8"
          />

          {/* Notes */}
          <Text style={om.label}>Notes</Text>
          <TextInput
            style={[om.input, { minHeight: 90, textAlignVertical: "top" }]}
            value={form.notes}
            onChangeText={v => set("notes", v)}
            placeholder="Additional notes..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </ScrollView>
        </KeyboardAvoidingView>

        <ContactPickerModal
          visible={contactPickerOpen}
          contacts={contacts}
          selectedId={form.contactId}
          onSelect={id => set("contactId", id)}
          onClose={() => setContactPickerOpen(false)}
        />
      </SafeAreaView>
    </View>
  );
}

const om = StyleSheet.create({
  overlayRoot:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000, elevation: 30 },
  root:          { flex: 1, backgroundColor: "#f8fafc" },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  title:         { fontSize: 15, fontWeight: "600", color: "#111827", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  closeBtn:      { paddingHorizontal: 4, paddingVertical: 2 },
  closeText:     { fontSize: 15, color: "#64748b", fontWeight: "600" },
  saveBtn:       { backgroundColor: "#0f766e", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  saveText:      { fontSize: 14, fontWeight: "700", color: "#fff" },
  body:          { padding: 16, gap: 4, paddingBottom: 320 },
  label:         { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input:         { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: "#0f172a" },
  chipScroll:    { flexGrow: 0, marginBottom: 2 },
  selectBox:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12 },
  selectText:    { flex: 1, fontSize: 14, fontWeight: "600", color: "#0f172a" },
  selectPlaceholder: { color: "#94a3b8", fontWeight: "500" },
  selectChevron: { fontSize: 14, color: "#94a3b8", marginLeft: 8 },
  row:           { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:          { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 6, marginBottom: 4 },
  chipActive:    { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  chipText:      { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive:{ color: "#fff" },
  priorityChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  priorityText:  { fontSize: 12, fontWeight: "700", color: "#64748b" },
});

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ opp, stagesMap, onClose, onEdit, onDelete }: {
  opp: Opportunity | null;
  stagesMap: Record<string, StageMeta>;
  onClose: () => void;
  onEdit: (opp: Opportunity) => void;
  onDelete: (opp: Opportunity) => void;
}) {
  if (!opp) return null;
  const stage = stagesMap[opp.stage];

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <View style={dm.row}>
        <Text style={dm.rowLabel}>{label}</Text>
        <Text style={dm.rowValue}>{value}</Text>
      </View>
    ) : null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["top", "bottom"]} style={dm.root}>
        <View style={dm.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={dm.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={dm.title} numberOfLines={1}>{opp.title}</Text>
          <TouchableOpacity onPress={() => { onClose(); onEdit(opp); }}>
            <Text style={dm.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={dm.body}>
          {/* Stage badge */}
          <View style={[dm.stageBadge, { backgroundColor: (stage?.color || "#0f766e") + "18" }]}>
            <Text style={[dm.stageLabel, { color: stage?.color || "#0f766e" }]}>{stage?.label || opp.stage}</Text>
          </View>

          <View style={dm.card}>
            <Row label="Contact"       value={opp.contactName} />
            <Row label="Phone"         value={opp.contactPhone} />
            <Row label="Amount"        value={opp.amount != null ? formatCurrency(opp.amount) : undefined} />
            <Row label="Probability"   value={opp.probability != null ? `${opp.probability}%` : undefined} />
            <Row label="Expected Rev." value={opp.expectedRevenue != null ? formatCurrency(opp.expectedRevenue) : undefined} />
            <Row label="Close Date"    value={formatDate(opp.expectedCloseDate)} />
            <Row label="Priority"      value={opp.priority} />
            <Row label="Source"        value={opp.source} />
            <Row label="Pipeline"      value={opp.pipelineName} />
            <Row label="Mapped Item"   value={opp.domainItemName} />
            <Row label="Activity SLA"  value={opp.activitySlaDueAt ? formatDate(opp.activitySlaDueAt) + (opp.activitySlaBreached ? " ⚠️ Overdue" : "") : undefined} />
            <Row label="Lost Reason"   value={opp.lostReason} />
            <Row label="Notes"         value={opp.notes} />
            <Row label="Last Updated"  value={formatDate(opp.updatedAt)} />
          </View>

          <TouchableOpacity style={dm.deleteBtn} onPress={() => onDelete(opp)}>
            <Text style={dm.deleteBtnText}>🗑  Delete Opportunity</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const dm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#f8fafc" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  title:       { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1, textAlign: "center", marginHorizontal: 8, fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  closeText:   { fontSize: 15, color: "#64748b", fontWeight: "600" },
  editText:    { fontSize: 15, color: "#0f766e", fontWeight: "700" },
  body:        { padding: 16, gap: 12, paddingBottom: 40 },
  stageBadge:  { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 4 },
  stageIcon:   { fontSize: 16 },
  stageLabel:  { fontSize: 13.5, fontWeight: "600", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  row:         { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  rowLabel:    { fontSize: 13, color: "#94a3b8", fontWeight: "600", flex: 1 },
  rowValue:    { fontSize: 13, color: "#0f172a", fontWeight: "600", flex: 2, textAlign: "right" },
  deleteBtn:   { marginTop: 8, paddingVertical: 14, alignItems: "center", borderRadius: 12, borderWidth: 1.5, borderColor: "#fca5a5", backgroundColor: "#fff5f5" },
  deleteBtnText: { fontSize: 14, fontWeight: "700", color: "#dc2626" },
});

// ─── Filters Sheet ────────────────────────────────────────────────────────────
interface Filters { ownerUserId: string; source: string; staleOnly: boolean; }
const EMPTY_FILTERS: Filters = { ownerUserId: "", source: "", staleOnly: false };

function FiltersModal({ visible, filters, sourceOptions, onApply, onClose }: {
  visible: boolean;
  filters: Filters;
  sourceOptions: string[];
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Filters>(filters);
  useEffect(() => { setLocal(filters); }, [filters, visible]);
  const set = (key: keyof Filters, val: any) => setLocal(f => ({ ...f, [key]: val }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={fm.overlay}>
        <View style={fm.sheet}>
          <View style={fm.sheetHeader}>
            <Text style={fm.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={() => { setLocal(EMPTY_FILTERS); }}>
              <Text style={fm.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <Text style={fm.label}>Source</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
            {["", ...sourceOptions].map(src => {
              const active = local.source === src;
              return (
                <TouchableOpacity
                  key={src || "__all"}
                  onPress={() => set("source", src)}
                  style={[fm.chip, active && fm.chipActive]}
                >
                  <Text style={[fm.chipText, active && fm.chipTextActive]}>
                    {src || "All sources"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() => set("staleOnly", !local.staleOnly)}
            style={fm.toggle}
          >
            <Text style={fm.toggleLabel}>Stale only ({STALE_DAYS}+ days inactive)</Text>
            <View style={[fm.pill, local.staleOnly && fm.pillOn]}>
              <Text style={[fm.pillText, local.staleOnly && fm.pillTextOn]}>
                {local.staleOnly ? "ON" : "OFF"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={fm.applyBtn}
            onPress={() => { onApply(local); onClose(); }}
          >
            <Text style={fm.applyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 4 },
  sheetHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle:   { fontSize: 16, fontWeight: "600", color: "#111827", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  clearText:    { fontSize: 13, color: "#0f766e", fontWeight: "700" },
  label:        { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chip:         { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 6 },
  chipActive:   { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  chipText:     { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
  toggle:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f8fafc", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 8 },
  toggleLabel:  { fontSize: 14, fontWeight: "600", color: "#334155" },
  pill:         { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: "#e2e8f0" },
  pillOn:       { backgroundColor: "#0f766e" },
  pillText:     { fontSize: 11, fontWeight: "700", color: "#94a3b8" },
  pillTextOn:   { color: "#fff" },
  applyBtn:     { marginTop: 16, backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  applyText:    { fontSize: 15, fontWeight: "700", color: "#fff" },
});

// ─── Floating Drag Card ───────────────────────────────────────────────────────
function FloatingCard({ opp, animXY, visible, stageColor }: {
  opp: Opportunity | null;
  animXY: Animated.ValueXY;
  visible: boolean;
  stageColor: string;
}) {
  if (!opp || !visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[fcard.card, { borderLeftColor: stageColor }, { transform: [{ translateX: animXY.x }, { translateY: animXY.y }] }]}
    >
      <Text style={fcard.title} numberOfLines={2}>{opp.title}</Text>
      {!!opp.contactName && <Text style={fcard.meta}>👤 {opp.contactName}</Text>}
      {!!opp.amount && <Text style={fcard.amount}>{formatCurrency(opp.amount)}</Text>}
    </Animated.View>
  );
}

const fcard = StyleSheet.create({
  card:   { position: "absolute", width: COL_W - 24, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderLeftWidth: 5, elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 16, zIndex: 9999 },
  title:  { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 5 },
  meta:   { fontSize: 12, color: "#64748b", marginBottom: 2 },
  amount: { fontSize: 13, fontWeight: "700", color: "#0f766e", marginTop: 3 },
});

// ─── Move To Bar ────────────────────────────────────────────────────────────
function MoveToBar({ targetStage, visible, stagesMap }: {
  targetStage: string | null;
  visible: boolean;
  stagesMap: Record<string, StageMeta>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, [visible]);

  const meta  = targetStage ? stagesMap[targetStage] : null;
  const color = meta?.color ?? "#0f766e";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        mtb.bar,
        { backgroundColor: color },
        { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] },
      ]}
    >
      <Text style={mtb.text}>
        {targetStage ? `Move To: ${meta?.label || targetStage}` : "Move to column"}
      </Text>
    </Animated.View>
  );
}

const mtb = StyleSheet.create({
  bar:  { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 18, alignItems: "center", zIndex: 8888, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  text: { fontSize: 15, fontWeight: "600", color: "#fff", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
});

// ─── Opp Card ─────────────────────────────────────────────────────────────────
function OppCard({ opp, onPress, onLongPress, faded, stageColor }: {
  opp: Opportunity;
  onPress: (opp: Opportunity) => void;
  onLongPress: (opp: Opportunity) => void;
  faded: boolean;
  stageColor: string;
}) {
  const pc   = PRIORITY_COLORS[opp.priority ?? ""] || null;
  const stale = isStaleCard(opp);

  return (
    <TouchableOpacity
      onPress={() => onPress(opp)}
      onLongPress={() => onLongPress(opp)}
      delayLongPress={250}
      activeOpacity={0.85}
      style={[oc.wrap, { borderLeftColor: stageColor, opacity: faded ? 0.25 : 1 }]}
    >
      <Text style={oc.title} numberOfLines={2}>{opp.title}</Text>
      {!!opp.contactName && (
        <Text style={oc.meta}>👤 {opp.contactName}{opp.contactPhone ? ` · ${opp.contactPhone}` : ""}</Text>
      )}
      {!!opp.domainItemName && (
        <Text style={oc.meta}>📦 {opp.domainItemName}</Text>
      )}

      <View style={oc.tags}>
        {pc && !!opp.priority && (
          <View style={[oc.tag, { backgroundColor: pc.bg }]}>
            <Text style={[oc.tagText, { color: pc.text }]}>{opp.priority}</Text>
          </View>
        )}
        {opp.amount != null && (
          <View style={[oc.tag, { backgroundColor: "#f0fdf4" }]}>
            <Text style={[oc.tagText, { color: "#16a34a" }]}>{formatCurrency(opp.amount)}</Text>
          </View>
        )}
        {opp.probability != null && (
          <View style={[oc.tag, { backgroundColor: "#eff6ff" }]}>
            <Text style={[oc.tagText, { color: "#2563eb" }]}>{opp.probability}%</Text>
          </View>
        )}
        {opp.activitySlaBreached && (
          <View style={[oc.tag, { backgroundColor: "#fee2e2" }]}>
            <Text style={[oc.tagText, { color: "#dc2626" }]}>SLA ⚠️</Text>
          </View>
        )}
        {stale && (
          <View style={[oc.tag, { backgroundColor: "#fff7ed" }]}>
            <Text style={[oc.tagText, { color: "#ea580c" }]}>Stale</Text>
          </View>
        )}
        {!!opp.expectedCloseDate && (
          <View style={[oc.tag, { backgroundColor: "#f0f9ff" }]}>
            <Text style={[oc.tagText, { color: "#0284c7" }]}>Close {formatDate(opp.expectedCloseDate)}</Text>
          </View>
        )}
      </View>

      {opp.stage === "LOST" && !!opp.lostReason && (
        <Text style={oc.lost} numberOfLines={1}>❌ {opp.lostReason}</Text>
      )}

      <View style={oc.footer}>
        <Text style={oc.date}>{formatDate(opp.updatedAt) || "No activity"}</Text>
        <Text style={oc.hint}>Hold to move</Text>
      </View>
    </TouchableOpacity>
  );
}

const oc = StyleSheet.create({
  wrap:     { backgroundColor: "#fff", borderRadius: 12, padding: 13, marginBottom: 9, borderLeftWidth: 4, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 3 },
  title:    { fontSize: 13, fontWeight: "700", color: "#0f172a", marginBottom: 5 },
  meta:     { fontSize: 11, color: "#64748b", marginBottom: 2 },
  tags:     { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5, marginBottom: 3 },
  tag:      { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  tagText:  { fontSize: 10, fontWeight: "700" },
  lost:     { fontSize: 11, color: "#dc2626", marginTop: 4 },
  footer:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  date:     { fontSize: 10, color: "#94a3b8" },
  hint:     { fontSize: 9, color: "#cbd5e1" },
});

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({ stage, opps, isDropTarget, onCardPress, onLongPress, draggingId, stagesMap, onAdd }: {
  stage: StageMeta;
  opps: Opportunity[];
  isDropTarget: boolean;
  onCardPress: (opp: Opportunity) => void;
  onLongPress: (opp: Opportunity) => void;
  draggingId: string | null;
  stagesMap: Record<string, StageMeta>;
  onAdd: (stageKey: string) => void;
}) {
  const totalValue = opps.reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <View style={[kc.col, { borderColor: isDropTarget ? stage.color : "transparent" }]}>
      {/* Header */}
      <View style={[kc.header, { borderBottomColor: stage.color }]}>
        <View style={{ flex: 1 }}>
          <Text style={[kc.label, { color: stage.color }]} numberOfLines={1}>{stage.label}</Text>
          {totalValue > 0 && <Text style={kc.value}>{formatCurrency(totalValue)}</Text>}
        </View>
        <View style={[kc.badge, { backgroundColor: stage.color }]}>
          <Text style={kc.badgeText}>{opps.length}</Text>
        </View>
        <TouchableOpacity onPress={() => onAdd(stage.key)} style={kc.addBtn}>
          <Text style={kc.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {isDropTarget && (
        <View style={[kc.dropHint, { borderColor: stage.color, backgroundColor: stage.color + "18" }]}>
          <Text style={[kc.dropHintText, { color: stage.color }]}>Release to move here</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={kc.list}
        nestedScrollEnabled
        scrollEnabled={!draggingId}
      >
        {opps.length === 0 && !isDropTarget ? (
          <View style={kc.empty}>
            <Text style={kc.emptyText}>No opportunities</Text>
            <TouchableOpacity onPress={() => onAdd(stage.key)} style={kc.emptyAdd}>
              <Text style={kc.emptyAddText}>+ Add one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          opps.map(o => (
            <OppCard
              key={o.id}
              opp={o}
              onPress={onCardPress}
              onLongPress={onLongPress}
              faded={draggingId === o.id}
              stageColor={stagesMap[o.stage]?.color ?? "#0f766e"}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const kc = StyleSheet.create({
  col:          { width: COL_W, backgroundColor: "#f1f5f9", borderRadius: 16, marginRight: 10, borderWidth: 2.5, borderColor: "transparent", maxHeight: SH * 0.68 },
  header:       { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 2.5 },
  icon:         { fontSize: 15 },
  label:        { fontSize: 12.5, fontWeight: "600", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  value:        { fontSize: 11, fontWeight: "600", color: "#64748b", marginTop: 1 },
  badge:        { borderRadius: 99, minWidth: 24, paddingHorizontal: 7, paddingVertical: 3, alignItems: "center" },
  badgeText:    { fontSize: 11, fontWeight: "700", color: "#fff" },
  addBtn:       { width: 28, height: 28, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  addBtnText:   { fontSize: 18, color: "#64748b", lineHeight: 22 },
  dropHint:     { marginHorizontal: 10, marginTop: 8, borderWidth: 2, borderStyle: "dashed", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  dropHintText: { fontSize: 12, fontWeight: "700" },
  list:         { padding: 10, paddingBottom: 24 },
  empty:        { paddingVertical: 28, alignItems: "center", gap: 8 },
  emptyText:    { fontSize: 12, color: "#cbd5e1", fontWeight: "600" },
  emptyAdd:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#cbd5e1" },
  emptyAddText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface ToastState { message: string; type: string }

export default function PipelineScreen() {
  // ── Data state ─────────────────────────────────────────────────────────────
  const [opps,              setOpps]              = useState<Opportunity[]>([]);
  const [pipelines,         setPipelines]         = useState<Pipeline[]>([]);
  const [selectedPipelineId,setSelectedPipelineId]= useState<string | number | null>(null);
  const [stages,            setStages]            = useState<StageMeta[]>(FALLBACK_STAGES);
  const [stageTotals,       setStageTotals]       = useState<Record<string, number>>({});
  const [contacts,          setContacts]          = useState<Contact[]>([]);
  const [domainItems,       setDomainItems]       = useState<DomainItem[]>([]);
  const [hasNextPage,       setHasNextPage]       = useState(false);
  const [currentPage,       setCurrentPage]       = useState(0);
  const [totalElements,     setTotalElements]     = useState(0);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [toast,          setToast]          = useState<ToastState | null>(null);
  const [search,         setSearch]         = useState("");
  const [filters,        setFilters]        = useState<Filters>(EMPTY_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editCard,     setEditCard]     = useState<Opportunity | null>(null);
  const [activeStage,  setActiveStage]  = useState("NEW");
  const [detailCard,   setDetailCard]   = useState<Opportunity | null>(null);
  const [lostVisible,  setLostVisible]  = useState(false);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [draggingOpp,    setDraggingOpp]    = useState<Opportunity | null>(null);
  const [dropTarget,     setDropTarget]     = useState<string | null>(null);
  const [moveBarVisible, setMoveBarVisible] = useState(false);
  const pendingMove  = useRef<{ opp: Opportunity; stage: string } | null>(null);
  const draggingRef  = useRef<Opportunity | null>(null);
  const columnBounds = useRef<Record<string, { left: number; right: number }>>({});
  const columnRefs   = useRef<Record<string, View | null>>({});
  const animXY       = useRef(new Animated.ValueXY({ x: -9999, y: -9999 })).current;
  draggingRef.current = draggingOpp;

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type = "success") => {
    setToast({ message, type });
  }, []);

  // ── Stages map ────────────────────────────────────────────────────────────
  const stagesMap = React.useMemo<Record<string, StageMeta>>(
    () => Object.fromEntries(stages.map(s => [s.key, s])),
    [stages]
  );

  // ── Fetch board ───────────────────────────────────────────────────────────
  const fetchBoard = useCallback(async ({ page = 0, append = false } = {}) => {
    setError(null);
    if (!append) setLoading(true);

    try {
      // Pipelines
      let pipelineList: Pipeline[] = [];
      let resolvedPipelineId: string | number | null = selectedPipelineId;
      try {
        const pr = await api.get("/api/pipelines");
        pipelineList = normalizeList(pr.data).map((p: any) => ({
          id: p.id, name: p.name, defaultPipeline: p.defaultPipeline, industryKey: p.industryKey,
        }));
        setPipelines(pipelineList);
        if (!resolvedPipelineId) {
          const def = pipelineList.find(p => p.defaultPipeline) || pipelineList[0];
          resolvedPipelineId = def?.id ?? null;
          setSelectedPipelineId(resolvedPipelineId);
        }
      } catch (e) { console.log("[Pipelines err]", e); }

      // Parallel: stages, opps, stage counts, contacts, domain items
      const params: any = { page, size: OPPORTUNITY_PAGE_SIZE };
      if (resolvedPipelineId) params.pipelineId = resolvedPipelineId;

      const [stageRes, oppRes, countRes, contactRes, domainRes] = await Promise.allSettled([
        api.get("/api/crm-config/pipeline-stages", resolvedPipelineId ? { params: { pipelineId: resolvedPipelineId } } : undefined),
        api.get("/api/opportunities/page", { params }),
        api.get("/api/opportunities/stage-counts", resolvedPipelineId ? { params: { pipelineId: resolvedPipelineId } } : undefined),
        api.get("/api/contacts/page?page=0&size=500"),
        api.get("/api/domain-items?activeOnly=true"),
      ]);

      // Stages
      const nextStages: StageMeta[] = stageRes.status === "fulfilled"
        ? buildStages(normalizeList(stageRes.value.data))
        : FALLBACK_STAGES;
      setStages(nextStages);

      // Opportunities
      if (oppRes.status === "fulfilled") {
        const raw = normalizeList(oppRes.value.data);
        const cards = raw.map((o: any) => toCard(o, nextStages));
        setOpps(prev => append ? [...prev.filter(p => !cards.find(c => c.id === p.id)), ...cards] : cards);
        const d = oppRes.value.data;
        setCurrentPage(Number(d?.page) || page);
        setHasNextPage(Boolean(d?.hasNext));
        setTotalElements(Number(d?.totalElements) || cards.length);
      } else {
        if (!append) setError("Failed to load opportunities");
      }

      // Stage counts
      if (countRes.status === "fulfilled") {
        setStageTotals(countRes.value.data || {});
      }

      // Contacts
      if (contactRes.status === "fulfilled") {
        setContacts(
          normalizeList(contactRes.value.data)
            .map((c: any) => ({ id: c.id || c._id, name: c.name || c.email || c.phone || "Unknown", phone: c.phone || "" }))
            .filter((c: Contact) => c.id)
        );
      }

      // Domain items
      if (domainRes.status === "fulfilled") {
        setDomainItems(normalizeList(domainRes.value.data));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedPipelineId]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchBoard();
  }, [fetchBoard]));

  // ── Load next page ────────────────────────────────────────────────────────
  const loadNextPage = () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    fetchBoard({ page: currentPage + 1, append: true });
  };

  // ── Move stage ────────────────────────────────────────────────────────────
  const doMove = async (opp: Opportunity, stage: string, lostReason: string | null) => {
    setOpps(prev =>
      prev.map(o =>
        o.id === opp.id
          ? { ...o, stage, lostReason: stage === "LOST" ? (lostReason ?? o.lostReason) : o.lostReason }
          : o
      )
    );
    try {
      await api.post(`/api/opportunities/${opp.id}/stage`, {
        stage,
        lostReason: stage === "LOST" ? lostReason : null,
      });
      showToast(`Moved to ${stagesMap[stage]?.label || stage}`);
    } catch (e: any) {
      setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, stage: opp.stage } : o));
      showToast(e?.response?.data?.message || "Stage update failed", "error");
    }
  };

  // ── Save (add / edit) ─────────────────────────────────────────────────────
  const saveCard = async (form: OppFormState) => {
    setSaving(true);
    const payload = {
      contactId: Number(form.contactId),
      title: form.title.trim(),
      stage: normalizeStageKey(form.stage),
      pipelineId: selectedPipelineId ? Number(selectedPipelineId) : null,
      amount: form.amount === "" ? null : Number(form.amount),
      probability: form.probability === "" ? null : Number(form.probability),
      priority: form.priority || "MEDIUM",
      lostReason: form.lostReason.trim() || null,
      expectedCloseDate: form.expectedCloseDate || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editCard) {
        const res = await api.put(`/api/opportunities/${editCard.id}`, payload);
        const updated = toCard(res.data, stages);
        setOpps(prev => prev.map(o => o.id === updated.id ? updated : o));
        showToast("Opportunity updated");
      } else {
        const res = await api.post("/api/opportunities", payload);
        const created = toCard(res.data, stages);
        setOpps(prev => [created, ...prev]);
        showToast("Opportunity added");
      }
      setModalOpen(false);
      setEditCard(null);
    } catch (e: any) {
      showToast(e?.response?.data?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteCard = (opp: Opportunity) => {
    Alert.alert("Delete", `Delete "${opp.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/opportunities/${opp.id}`);
            setOpps(prev => prev.filter(o => o.id !== opp.id));
            setDetailCard(null);
            showToast("Deleted", "info");
          } catch (e: any) {
            showToast(e?.response?.data?.message || "Delete failed", "error");
          }
        },
      },
    ]);
  };

  // ── Drag/drop ──────────────────────────────────────────────────────────────
  const measureAll = useCallback(() => {
    stages.forEach(s => {
      columnRefs.current[s.key]?.measureInWindow((x, _y, w) => {
        columnBounds.current[s.key] = { left: x, right: x + w };
      });
    });
  }, [stages]);

  const hitStage = (screenX: number): string | null => {
    for (const [key, b] of Object.entries(columnBounds.current)) {
      if (screenX >= b.left && screenX <= b.right) return key;
    }
    return null;
  };

  const handleLongPress = useCallback((opp: Opportunity) => {
    measureAll();
    setDraggingOpp(opp);
    setMoveBarVisible(true);
  }, [measureAll]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder:        () => !!draggingRef.current,
      onMoveShouldSetPanResponderCapture: () => !!draggingRef.current,
      onPanResponderMove: (evt) => {
        if (!draggingRef.current) return;
        const { pageX, pageY } = evt.nativeEvent;
        animXY.setValue({ x: pageX - (COL_W - 24) / 2, y: pageY - 80 });
        setDropTarget(hitStage(pageX));
      },
      onPanResponderRelease: (evt) => {
        const { pageX } = evt.nativeEvent;
        const target = hitStage(pageX);
        const opp    = draggingRef.current;
        animXY.setValue({ x: -9999, y: -9999 });
        setDraggingOpp(null);
        setDropTarget(null);
        setMoveBarVisible(false);
        if (!opp || !target || target === opp.stage) return;
        if (target === "LOST") {
          pendingMove.current = { opp, stage: target };
          setLostVisible(true);
        } else {
          doMove(opp, target, null);
        }
      },
      onPanResponderTerminate: () => {
        animXY.setValue({ x: -9999, y: -9999 });
        setDraggingOpp(null);
        setDropTarget(null);
        setMoveBarVisible(false);
      },
    })
  ).current;

  // ── Filter & group ────────────────────────────────────────────────────────
  const filteredOpps = React.useMemo(() => {
    return opps.filter(o => {
      if (selectedPipelineId && String(o.pipelineId) !== String(selectedPipelineId)) return false;
      if (filters.source && (o.source || o.contactLeadSource) !== filters.source) return false;
      if (filters.staleOnly && !isStaleCard(o)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.title?.toLowerCase().includes(q) ||
        o.contactName?.toLowerCase().includes(q) ||
        (o.contactPhone || "").includes(q) ||
        (o.source || "").toLowerCase().includes(q)
      );
    });
  }, [opps, selectedPipelineId, filters, search]);

  const byStage = React.useMemo(() => {
    return stages.reduce<Record<string, Opportunity[]>>((acc, s) => {
      acc[s.key] = filteredOpps.filter(o => o.stage === s.key);
      return acc;
    }, {});
  }, [stages, filteredOpps]);

  const sourceOptions = React.useMemo(
    () => Array.from(new Set(opps.map(o => o.source || o.contactLeadSource || "").filter(Boolean))).sort(),
    [opps]
  );

  const totalLoaded  = filteredOpps.length;
  const wonCount     = byStage["WON"]?.length ?? 0;
  const closeRate    = totalLoaded > 0 ? Math.round((wonCount / totalLoaded) * 100) : 0;
  const activeFilterCount = Object.values(filters).filter(v => v !== "" && v !== false).length;

  // ── Open add/edit ─────────────────────────────────────────────────────────
  const openAdd = (stageKey: string) => {
    setEditCard(null);
    setActiveStage(stageKey);
    setModalOpen(true);
  };

  const openEdit = (opp: Opportunity) => {
    setEditCard(opp);
    setActiveStage(opp.stage);
    setDetailCard(null);
    setModalOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && !refreshing) return <LoadingSpinner message="Loading pipeline..." />;

  return (
    <SafeAreaView edges={[]} style={s.root}>
      {!!error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchBoard(); }} />}

      {/* ── Top Bar ── */}
      <View style={s.topBar}>
        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statN}>{totalLoaded}</Text>
            <Text style={s.statL}>{search || activeFilterCount ? "Matching" : "Total"}</Text>
          </View>
          <View style={s.div} />
          <View style={s.stat}>
            <Text style={[s.statN, { color: "#059669" }]}>{wonCount}</Text>
            <Text style={s.statL}>Won</Text>
          </View>
          <View style={s.div} />
          <View style={s.stat}>
            <Text style={s.statN}>{closeRate}%</Text>
            <Text style={s.statL}>Close Rate</Text>
          </View>
          {totalElements > opps.length && (
            <>
              <View style={s.div} />
              <View style={s.stat}>
                <Text style={s.statN}>{totalElements}</Text>
                <Text style={s.statL}>In Pipeline</Text>
              </View>
            </>
          )}
        </View>

        {/* Pipeline selector */}
        {pipelines.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pipelineScroll}>
            {pipelines.map(p => {
              const active = String(p.id) === String(selectedPipelineId);
              return (
                <TouchableOpacity
                  key={String(p.id)}
                  style={[s.pipelineChip, active && s.pipelineChipActive]}
                  onPress={() => setSelectedPipelineId(p.id)}
                >
                  <Text style={[s.pipelineChipText, active && s.pipelineChipTextActive]} numberOfLines={1}>
                    {p.name}{p.defaultPipeline ? " ★" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Search + filter row */}
        <View style={s.searchRow}>
          <TextInput
            style={s.search}
            value={search}
            onChangeText={setSearch}
            placeholder="🔍  Search opportunities..."
            placeholderTextColor="#94a3b8"
            clearButtonMode="while-editing"
            editable={!draggingOpp}
          />
          <TouchableOpacity
            onPress={() => setFiltersVisible(true)}
            style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          >
            <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>
              ⚙ {activeFilterCount > 0 ? `(${activeFilterCount})` : "Filter"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openAdd(stages[0]?.key || "NEW")}
            style={s.addBtn}
            disabled={contacts.length === 0}
          >
            <Text style={s.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hint ── */}
      <View style={s.hint}>
        <Text style={s.hintT}>
          {draggingOpp ? "🎯 Drag to target column and release" : "⟺ Scroll between stages  ·  Tap card to view  ·  Hold to move"}
        </Text>
      </View>

      {/* ── Board ── */}
      <View style={s.boardWrap} {...panResponder.panHandlers}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.board}
          scrollEnabled={!draggingOpp}
          scrollEventThrottle={16}
          onScroll={measureAll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchBoard(); }}
              tintColor="#0f766e"
            />
          }
        >
          {stages.map(stage => (
            <View
              key={stage.key}
              ref={r => { columnRefs.current[stage.key] = r; if (r) setTimeout(measureAll, 150); }}
            >
              <KanbanColumn
                stage={stage}
                opps={byStage[stage.key] ?? []}
                isDropTarget={dropTarget === stage.key}
                onCardPress={setDetailCard}
                onLongPress={handleLongPress}
                draggingId={draggingOpp?.id ?? null}
                stagesMap={stagesMap}
                onAdd={openAdd}
              />
            </View>
          ))}

          {/* Load more column */}
          {(hasNextPage || totalElements > opps.length) && (
            <View style={s.loadMoreCol}>
              <Text style={s.loadMoreMeta}>
                {opps.length} loaded of {totalElements}
              </Text>
              <TouchableOpacity
                onPress={loadNextPage}
                disabled={loadingMore || !hasNextPage}
                style={s.loadMoreBtn}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color="#0f766e" />
                  : <Text style={s.loadMoreBtnText}>Load next {OPPORTUNITY_PAGE_SIZE}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <FloatingCard
          opp={draggingOpp}
          animXY={animXY}
          visible={!!draggingOpp}
          stageColor={draggingOpp ? (stagesMap[draggingOpp.stage]?.color ?? "#0f766e") : "#0f766e"}
        />
        <MoveToBar targetStage={dropTarget} visible={moveBarVisible} stagesMap={stagesMap} />
      </View>

      {/* ── Modals ── */}
      <LostReasonModal
        visible={lostVisible}
        onConfirm={reason => {
          setLostVisible(false);
          if (!pendingMove.current) return;
          const { opp, stage } = pendingMove.current;
          pendingMove.current = null;
          doMove(opp, stage, reason || null);
        }}
        onCancel={() => { setLostVisible(false); pendingMove.current = null; }}
      />

      <OpportunityModal
        open={modalOpen}
        stages={stages}
        contacts={contacts}
        initial={editCard}
        defaultStage={activeStage}
        saving={saving}
        onClose={() => { setModalOpen(false); setEditCard(null); }}
        onSave={saveCard}
      />

      <DetailModal
        opp={detailCard}
        stagesMap={stagesMap}
        onClose={() => setDetailCard(null)}
        onEdit={openEdit}
        onDelete={deleteCard}
      />

      <FiltersModal
        visible={filtersVisible}
        filters={filters}
        sourceOptions={sourceOptions}
        onApply={setFilters}
        onClose={() => setFiltersVisible(false)}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </SafeAreaView>
  );
}

// ─── Root Styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: "#f1f5f9" },
  topBar:               { backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 10 },
  statsRow:             { flexDirection: "row", alignItems: "center", gap: 12 },
  stat:                 { alignItems: "center" },
  statN:                { fontSize: 17, fontWeight: "700", color: "#111827", fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined },
  statL:                { fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  div:                  { width: 1, height: 26, backgroundColor: "#e2e8f0" },
  pipelineScroll:       { gap: 6 },
  pipelineChip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 6 },
  pipelineChipActive:   { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  pipelineChipText:     { fontSize: 12, fontWeight: "600", color: "#64748b" },
  pipelineChipTextActive: { color: "#fff" },
  searchRow:            { flexDirection: "row", alignItems: "center", gap: 8 },
  search:               { flex: 1, height: 38, backgroundColor: "#f8fafc", borderRadius: 10, paddingHorizontal: 14, fontSize: 14, color: "#1e293b", borderWidth: 1, borderColor: "#e2e8f0" },
  filterBtn:            { height: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  filterBtnActive:      { backgroundColor: "#f0fdf4", borderColor: "#0f766e" },
  filterBtnText:        { fontSize: 12, fontWeight: "700", color: "#64748b" },
  filterBtnTextActive:  { color: "#0f766e" },
  addBtn:               { width: 38, height: 38, borderRadius: 10, backgroundColor: "#0f766e", justifyContent: "center", alignItems: "center" },
  addBtnText:           { fontSize: 22, color: "#fff", lineHeight: 26 },
  hint:                 { backgroundColor: "#eff6ff", paddingVertical: 5, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#dbeafe" },
  hintT:                { fontSize: 11, color: "#3b82f6", fontWeight: "600", textAlign: "center" },
  boardWrap:            { flex: 1, position: "relative" },
  board:                { paddingHorizontal: 12, paddingVertical: 12, alignItems: "flex-start" },
  loadMoreCol:          { width: 180, backgroundColor: "#f8fafc", borderRadius: 16, marginRight: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#cbd5e1", padding: 16, alignItems: "center", justifyContent: "center", gap: 12 },
  loadMoreMeta:         { fontSize: 12, color: "#94a3b8", fontWeight: "600", textAlign: "center" },
  loadMoreBtn:          { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  loadMoreBtnText:      { fontSize: 13, fontWeight: "700", color: "#0f766e" },
});