/**
 * TaskKanbanScreen.tsx
 *
 * Native Kanban board with drag-and-drop via react-native-draggable-flatlist.
 * On web (Platform.OS === 'web'), drag-and-drop is disabled and a plain
 * FlatList / ScrollView is used instead — this silences the
 * `findNodeHandle is not supported on web` and React-19 ref errors.
 *
 * Install (native only):
 *   npx expo install react-native-draggable-flatlist react-native-gesture-handler react-native-reanimated
 *
 * App.tsx entry — wrap root:
 *   import { GestureHandlerRootView } from 'react-native-gesture-handler';
 *   <GestureHandlerRootView style={{ flex: 1 }}>...</GestureHandlerRootView>
 *
 * babel.config.js — add plugin:
 *   plugins: ['react-native-reanimated/plugin']
 */

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

// Drag-and-drop imports are native-only.
// On web these modules fail at runtime, so we import them conditionally.
let NestableDraggableFlatList: any = null;
let NestableScrollContainer: any = null;
let ScaleDecorator: any = null;

if (Platform.OS !== "web") {
  const dnd = require("react-native-draggable-flatlist");
  NestableDraggableFlatList = dnd.NestableDraggableFlatList;
  NestableScrollContainer   = dnd.NestableScrollContainer;
  ScaleDecorator            = dnd.ScaleDecorator;
}

import api from "../../api/client"; // adjust path to match your project
import { Contact, Task, User } from "../../types"; // adjust path

/* ─── Platform flag ───────────────────────────────────────────────── */
const IS_WEB = Platform.OS === "web";

/* ─── Internal card type (extends Task with kanban fields) ────────── */
interface TaskCard extends Task {
  /** Always a string so it can be used as FlatList key */
  key: string;
  contactId?: number | string;
  contactName?: string;
  contactPhone?: string;
  assignedUserEmail?: string;
  createdByUserEmail?: string;
  tags: string[];
  /** datetime-local string for the form */
  date: string;
  status: StatusKey;
  priority: string;
}

type StatusKey = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface KanbanColumn {
  id: StatusKey;
  name: string;
  cards: TaskCard[];
}

/* ─── Constants ───────────────────────────────────────────────────── */
const STATUS_COLUMNS: { id: StatusKey; name: string }[] = [
  { id: "OPEN",        name: "Open"        },
  { id: "IN_PROGRESS", name: "In Progress" },
  { id: "COMPLETED",   name: "Completed"   },
  { id: "CANCELLED",   name: "Cancelled"   },
];

const STATUS_MAP: Record<string, StatusKey> = {
  OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED", CANCELLED: "CANCELLED",
  TO_DO: "OPEN", TODO: "OPEN", DONE: "COMPLETED", REVIEW: "IN_PROGRESS",
};

const COLUMN_COLORS: Record<StatusKey, string> = {
  OPEN:        "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED:   "#10b981",
  CANCELLED:   "#ef4444",
};

const PRIORITY_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high:   { label: "High",   bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
  medium: { label: "Medium", bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  low:    { label: "Low",    bg: "#f0fdf4", text: "#166534", dot: "#10b981" },
};

const TAGS = [
  "Admin","Layout","Dashboard","Design","Website",
  "Marketing","Business","Logo","UI/UX","Analysis",
  "Product","Ecommerce","Graphic",
];

let _seq = 100;
const uid = (): string => `local-${++_seq}`;

/* ─── Helpers ─────────────────────────────────────────────────────── */
const normalizeStatus = (value: unknown): StatusKey =>
  STATUS_MAP[String(value ?? "OPEN").trim().toUpperCase().replaceAll(" ", "_")] ?? "OPEN";

const safeId = (value: number | string | undefined): string =>
  value != null ? String(value) : uid();

const toDueAt = (date: string): string | null => {
  if (!date) return null;
  return date.includes("T") ? new Date(date).toISOString() : `${date}T09:00:00+05:30`;
};

const displayDate = (value?: string): string => {
  if (!value) return "No date";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const dueMeta = (date?: string): { label: string; color: string } => {
  if (!date) return { label: "No Date", color: "#94a3b8" };
  const dateOnly = date.split("T")[0];
  const due = new Date(`${dateOnly}T23:59:59`);
  if (isNaN(due.getTime())) return { label: date, color: "#94a3b8" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dueDay = new Date(due); dueDay.setHours(0, 0, 0, 0);
  if (dueDay < today)                               return { label: "Overdue",   color: "#ef4444" };
  if (dueDay.getTime() === today.getTime())         return { label: "Today",     color: "#3b82f6" };
  if (dueDay.getTime() === tomorrow.getTime())      return { label: "Tomorrow",  color: "#f59e0b" };
  return { label: "Upcoming", color: "#10b981" };
};

/** Coerce any API response shape into Task[] */
const normalizeTaskList = (raw: unknown): Task[] => {
  if (Array.isArray(raw)) return raw as Task[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data))    return r.data    as Task[];
    if (Array.isArray(r.tasks))   return r.tasks   as Task[];
    if (Array.isArray(r.items))   return r.items   as Task[];
    if (Array.isArray(r.content)) return r.content as Task[];
    if ((raw as Task).title != null) return [raw as Task];
  }
  return [];
};

/** Map a Task from the API into our internal TaskCard */
const taskToCard = (t: Task & Record<string, unknown>): TaskCard => ({
  ...t,
  key:              safeId(t.id ?? t._id),
  id:               t.id ?? t._id,
  contactId:        t.contactId as number | string | undefined,
  contactName:      t.contactName as string | undefined,
  contactPhone:     (t.contactPhone as string | undefined),
  assignedUserEmail:(t.assignedUserEmail as string | undefined) ?? (t.assignedTo as string | undefined),
  createdByUserEmail: t.createdByUserEmail as string | undefined,
  title:            t.title || "Untitled",
  description:      t.description,
  priority:         (t.priority ?? "medium").toLowerCase(),
  tags:             Array.isArray(t.tags) ? (t.tags as string[]) : [],
  date:             t.dueAt ? t.dueAt.slice(0, 16) : "",
  dueAt:            t.dueAt,
  status:           normalizeStatus(t.status),
});

const toColumns = (tasks: Task[]): KanbanColumn[] => {
  const map = new Map<StatusKey, TaskCard[]>();
  STATUS_COLUMNS.forEach(({ id }) => map.set(id, []));
  tasks.forEach((t) => {
    const card = taskToCard(t as Task & Record<string, unknown>);
    map.get(card.status)!.push(card);
  });
  return STATUS_COLUMNS.map(({ id, name }) => ({ id, name, cards: map.get(id)! }));
};

const EMPTY_COLS: KanbanColumn[] = STATUS_COLUMNS.map(({ id, name }) => ({ id, name, cards: [] }));

/* ─── API calls ───────────────────────────────────────────────────── */
const taskApi = {
  getContacts: async (): Promise<Contact[]> => {
    try {
      const r = await api.get("/api/contacts/page", { params: { page: 0, size: 200 } });
      return (r.data?.items as Contact[]) ?? [];
    } catch {
      const r = await api.get("/api/contacts");
      return Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.contacts ?? []);
    }
  },
  getTasks:     (cid: string | number) =>
    api.get(`/api/contacts/${cid}/tasks`).then((r) => r.data),
  createTask:   (cid: string | number, data: object) =>
    api.post(`/api/contacts/${cid}/tasks`, data).then((r) => r.data as Task),
  updateTask:   (cid: string | number, tid: string | number, data: object) =>
    api.put(`/api/contacts/${cid}/tasks/${tid}`, data).then((r) => r.data as Task),
  deleteTask:   (cid: string | number, tid: string | number) =>
    api.delete(`/api/contacts/${cid}/tasks/${tid}`).then(() => true),
  updateStatus: (cid: string | number, tid: string | number, status: string) =>
    api.post(`/api/contacts/${cid}/tasks/${tid}/status`, { status }).then((r) => r.data as Task),
  getMyTasks:   () => api.get("/api/tasks/my-tasks").then((r) => r.data),
  getTeamTasks: () => api.get("/api/tasks/team").then((r) => r.data),
  getToday:     () => api.get("/api/tasks/today").then((r) => r.data),
  getOverdue:   () => api.get("/api/tasks/overdue").then((r) => r.data),
  getUsers:     () => api.get("/api/users").then((r) => r.data),
};

/* ─── Toast ───────────────────────────────────────────────────────── */
type ToastType = "success" | "error" | "info";

function Toast({ msg, type, onDone }: { msg: string; type: ToastType; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);

  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: "#dcfce7", border: "#166534", text: "#166534" },
    error:   { bg: "#fee2e2", border: "#991b1b", text: "#991b1b" },
    info:    { bg: "#dbeafe", border: "#1e40af", text: "#1e40af" },
  };
  const { bg, border, text } = colors[type];
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  return (
    <View style={[styles.toast, { backgroundColor: bg, borderColor: border }]}>
      <Text style={{ color: text, fontWeight: "700", fontSize: 13 }}>{icon}  {msg}</Text>
    </View>
  );
}

/* ─── Contact Picker Modal ────────────────────────────────────────── */
function ContactPickerModal({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (c: Contact) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState("");

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    taskApi.getContacts()
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = contacts.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Contact</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={{ fontSize: 18, color: "#475569" }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search contacts…"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#0f766e" /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.center}><Text style={{ color: "#94a3b8" }}>No contacts found</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
            {filtered.map((c) => {
              const cid = safeId(c.id ?? c._id);
              return (
                <TouchableOpacity
                  key={cid}
                  style={styles.contactRow}
                  onPress={() => { onSelect(c); onClose(); }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {c.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactSub}>{c.email ?? c.phone ?? `ID: ${cid}`}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Task Form Modal ─────────────────────────────────────────────── */
interface FormState {
  title: string;
  description: string;
  priority: string;
  assignedUserId: string;
  tags: string[];
  date: string;
  colId: StatusKey;
}

function TaskFormModal({
  visible, onClose, onSave, initial, colId, columns, users, loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: FormState & { cardKey: string }) => void;
  initial: TaskCard | null;
  colId: StatusKey;
  columns: KanbanColumn[];
  users: User[];
  loading: boolean;
}) {
  const blank: FormState = {
    title: "", description: "", priority: "medium",
    assignedUserId: "", tags: [], date: "", colId,
  };
  const [form, setForm]     = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setForm({
        title:          initial.title,
        description:    initial.description ?? "",
        priority:       initial.priority,
        assignedUserId: String(initial.assignedUserEmail ?? ""),
        tags:           initial.tags,
        date:           initial.date,
        colId:          initial.status,
      });
    } else {
      setForm({ ...blank, colId });
    }
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleTag = (t: string) =>
    set("tags", form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t]);

  const submit = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim())       e.title       = "Task name is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, cardKey: initial?.key ?? uid() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{initial ? "Edit Task" : "New Task"}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={{ fontSize: 18, color: "#475569" }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={styles.fieldLabel}>TASK NAME *</Text>
          <TextInput
            value={form.title}
            onChangeText={(v) => { set("title", v); setErrors((e) => ({ ...e, title: undefined })); }}
            placeholder="Enter task name…"
            placeholderTextColor="#94a3b8"
            style={[styles.input, errors.title ? styles.inputError : null]}
          />
          {!!errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

          {/* Description */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>DESCRIPTION *</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => { set("description", v); setErrors((e) => ({ ...e, description: undefined })); }}
            placeholder="What needs to be done?"
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            style={[styles.input, { height: 80, textAlignVertical: "top" }, errors.description ? styles.inputError : null]}
          />
          {!!errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

          {/* Priority */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>PRIORITY</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["low", "medium", "high"] as const).map((p) => {
              const meta = PRIORITY_META[p];
              const active = form.priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => set("priority", p)}
                  style={[
                    styles.priorityBtn,
                    { backgroundColor: active ? meta.bg : "#f8fafc", borderColor: active ? meta.dot : "#e2e8f0" },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? meta.text : "#64748b" }}>
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Column */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>COLUMN</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {columns.map((col) => {
              const active = form.colId === col.id;
              const color  = COLUMN_COLORS[col.id];
              return (
                <TouchableOpacity
                  key={col.id}
                  onPress={() => set("colId", col.id)}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? color + "18" : "#f8fafc", borderColor: active ? color : "#e2e8f0" },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: active ? color : "#64748b" }}>
                    {col.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Assign */}
          {users.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>ASSIGN TO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[{ id: "", email: "Unassigned", role: "AGENT" as const, tenantId: "" }, ...users].map((u, i) => {
                  const active = form.assignedUserId === String(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id === "" ? "unassigned" : String(u.id)}
                      onPress={() => set("assignedUserId", String(u.id))}
                      style={[
                        styles.chip,
                        { marginLeft: i === 0 ? 0 : 8, borderColor: active ? "#0f766e" : "#e2e8f0", backgroundColor: active ? "#f0fdfa" : "#f8fafc" },
                      ]}
                    >
                      <Text style={{ fontSize: 12, color: active ? "#0f766e" : "#64748b", fontWeight: "600" }}>
                        {u.email}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Tags */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>TAGS</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {TAGS.map((t) => {
              const active = form.tags.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => toggleTag(t)}
                  style={[
                    styles.tagChip,
                    { backgroundColor: active ? "#f0fdfa" : "#f8fafc", borderColor: active ? "#0f766e" : "#e2e8f0" },
                  ]}
                >
                  <Text style={{ fontSize: 11, color: active ? "#0f766e" : "#64748b", fontWeight: active ? "700" : "400" }}>
                    {active ? "✓ " : ""}{t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save */}
          <TouchableOpacity onPress={submit} disabled={loading} style={[styles.saveBtn, loading && { opacity: 0.6 }]}>
            <Text style={styles.saveBtnText}>
              {loading ? "Saving…" : initial ? "Update Task" : "Create Task"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Task Card ───────────────────────────────────────────────────── */
/**
 * On native: wrapped in ScaleDecorator, receives drag/isActive from draggable list.
 * On web:    ScaleDecorator is skipped; drag is a no-op; isActive is always false.
 */
function TaskCardView({
  card, drag, isActive, onEdit, onDelete,
}: {
  card: TaskCard;
  drag: () => void;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pri = PRIORITY_META[card.priority] ?? PRIORITY_META.medium;
  const due = dueMeta(card.date || card.dueAt);

  const confirmDelete = () => {
    if (IS_WEB) {
      // Alert.alert is not reliable on web in some RN Web setups
      if (window.confirm(`Delete "${card.title}"?`)) onDelete();
    } else {
      Alert.alert("Delete Task", `Delete "${card.title}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
    }
  };

  const cardContent = (
    <View style={[styles.card, isActive && styles.cardActive, { borderLeftColor: pri.dot }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        {!IS_WEB && (
          <TouchableOpacity onLongPress={drag} disabled={isActive} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.dragIcon}>⠿</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.cardId}>#{safeId(card.id ?? card._id).slice(-4)}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onEdit} style={styles.cardAction}>
          <Text style={{ fontSize: 12 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={[styles.cardAction, { marginLeft: 4 }]}>
          <Text style={{ fontSize: 12 }}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>

      {/* Contact info */}
      <View style={styles.infoChip}>
        <InfoRow label="Contact" value={card.contactName ?? `#${card.contactId ?? "—"}`} />
        {!!card.contactPhone && <InfoRow label="Phone" value={card.contactPhone} />}
        <InfoRow label="Assigned" value={card.assignedUserEmail ?? card.assignedTo ?? "Unassigned"} />
        {!!card.createdByUserEmail && <InfoRow label="Created by" value={card.createdByUserEmail} />}
      </View>

      {/* Description */}
      {!!card.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{card.description}</Text>
      )}

      {/* Tags */}
      {card.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {card.tags.slice(0, 3).map((t) => (
            <View key={t} style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{t}</Text>
            </View>
          ))}
          {card.tags.length > 3 && (
            <Text style={styles.tagMore}>+{card.tags.length - 3}</Text>
          )}
        </View>
      )}

      {/* Priority + due */}
      <View style={styles.cardFooter}>
        <View style={[styles.priBadge, { backgroundColor: pri.bg }]}>
          <View style={[styles.dot, { backgroundColor: pri.dot }]} />
          <Text style={[styles.priBadgeText, { color: pri.text }]}>{pri.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[styles.dueLabel, { color: due.color }]}>{due.label}</Text>
      </View>

      <Text style={styles.dateText}>📅 {displayDate(card.dueAt ?? card.date)}</Text>
    </View>
  );

  // On native, wrap with ScaleDecorator for the animated drag effect.
  // On web, render the card directly (no drag library involved at all).
  if (!IS_WEB && ScaleDecorator) {
    return <ScaleDecorator>{cardContent}</ScaleDecorator>;
  }
  return cardContent;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/* ─── Kanban Column ───────────────────────────────────────────────── */
function KanbanColumnView({
  col, onAddCard, onEditCard, onDeleteCard, onDragEnd,
}: {
  col: KanbanColumn;
  onAddCard: (colId: StatusKey) => void;
  onEditCard: (card: TaskCard) => void;
  onDeleteCard: (card: TaskCard) => void;
  onDragEnd: (colId: StatusKey, newCards: TaskCard[]) => void;
}) {
  const accent = COLUMN_COLORS[col.id];

  // Native render item (receives drag/isActive from draggable list)
  const renderNativeItem = useCallback(
    ({ item, drag, isActive }: { item: TaskCard; drag: () => void; isActive: boolean }) => (
      <TaskCardView
        card={item}
        drag={drag}
        isActive={isActive}
        onEdit={() => onEditCard(item)}
        onDelete={() => onDeleteCard(item)}
      />
    ),
    [onEditCard, onDeleteCard],
  );

  // Web render item (plain FlatList — no drag props)
  const renderWebItem = useCallback(
    ({ item }: { item: TaskCard }) => (
      <TaskCardView
        card={item}
        drag={() => {}}
        isActive={false}
        onEdit={() => onEditCard(item)}
        onDelete={() => onDeleteCard(item)}
      />
    ),
    [onEditCard, onDeleteCard],
  );

  const emptyComponent = (
    <View style={styles.emptyCol}>
      <Text style={styles.emptyColText}>
        {IS_WEB ? "No tasks" : "No tasks · long-press to drag"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.column, { borderTopColor: accent }]}>
      {/* Header */}
      <View style={styles.columnHeader}>
        <View style={[styles.dot, { backgroundColor: accent, width: 8, height: 8 }]} />
        <Text style={styles.colName}>{col.name}</Text>
        <View style={[styles.colCount, { backgroundColor: accent + "22" }]}>
          <Text style={[styles.colCountText, { color: accent }]}>{col.cards.length}</Text>
        </View>
      </View>

      {/* Cards list — platform-branched */}
      {IS_WEB ? (
        <FlatList<TaskCard>
          data={col.cards}
          keyExtractor={(item) => item.key}
          renderItem={renderWebItem}
          scrollEnabled={false}
          ListEmptyComponent={emptyComponent}
        />
      ) : (
        <NestableDraggableFlatList<TaskCard>
          data={col.cards}
          keyExtractor={(item: TaskCard) => item.key}
          renderItem={renderNativeItem}
          onDragEnd={({ data }: { data: TaskCard[] }) => onDragEnd(col.id, data)}
          scrollEnabled={false}
          ListEmptyComponent={emptyComponent}
        />
      )}

      {/* Add */}
      <TouchableOpacity
        onPress={() => onAddCard(col.id)}
        style={[styles.addMoreBtn, { borderColor: accent + "60" }]}
      >
        <Text style={[styles.addMoreText, { color: accent }]}>+ Add Task</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Filter pills ────────────────────────────────────────────────── */
const FILTERS = [
  { key: "team",     label: "Team",    icon: "👥", color: "#10b981" },
  { key: "my-tasks", label: "Mine",    icon: "👤", color: "#8b5cf6" },
  { key: "today",    label: "Today",   icon: "🗓", color: "#3b82f6" },
  { key: "overdue",  label: "Overdue", icon: "⚠️",  color: "#ef4444" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

function FilterPills({
  active, loading, onSelect,
}: {
  active: FilterKey | null;
  loading: boolean;
  onSelect: (f: FilterKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterBar}
      contentContainerStyle={{ gap: 8, alignItems: "center" as const }}
    >
      {FILTERS.map(({ key, label, icon, color }) => {
        const on = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onSelect(key)}
            style={[
              styles.filterPill,
              { backgroundColor: on ? color + "18" : "#f8fafc", borderColor: on ? color : "#e2e8f0" },
            ]}
          >
            <Text style={{ fontSize: 12 }}>{loading && on ? "⟳" : icon}</Text>
            <Text style={{ fontSize: 12, fontWeight: "700", color: on ? color : "#64748b", marginLeft: 4 }}>
              {label}
            </Text>
            {on && <Text style={{ fontSize: 10, color, marginLeft: 2 }}>×</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ─── Board wrapper — platform-branched ──────────────────────────── */
/**
 * On native, NestableScrollContainer is required as the outer scroll wrapper
 * so that NestableDraggableFlatList can compute its layout correctly.
 * On web we use a plain ScrollView.
 */
function BoardScrollWrapper({ children }: { children: React.ReactNode }) {
  if (IS_WEB) {
    return <ScrollView style={{ flex: 1 }}>{children}</ScrollView>;
  }
  return <NestableScrollContainer style={{ flex: 1 }}>{children}</NestableScrollContainer>;
}

/* ─── Main Screen ─────────────────────────────────────────────────── */
export default function TaskKanbanScreen() {
  const [columns, setColumns]             = useState<KanbanColumn[]>(EMPTY_COLS);
  const [contactId, setContactId]         = useState<string | null>(null);
  const [contactName, setContactName]     = useState<string | null>(null);
  const [users, setUsers]                 = useState<User[]>([]);
  const [search, setSearch]               = useState("");
  const [apiLoading, setApiLoading]       = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeFilter, setActiveFilter]   = useState<FilterKey | null>(null);
  const [taskSaving, setTaskSaving]       = useState(false);
  const [contactModal, setContactModal]   = useState(false);
  const [taskFormModal, setTaskFormModal] = useState(false);
  const [editCard, setEditCard]           = useState<TaskCard | null>(null);
  const [activeColId, setActiveColId]     = useState<StatusKey>("OPEN");
  const [toast, setToast]                 = useState<{ msg: string; type: ToastType } | null>(null);

  const showToast = useCallback(
    (msg: string, type: ToastType = "success") => setToast({ msg, type }),
    [],
  );

  /* load users */
  useEffect(() => {
    taskApi.getUsers()
      .then((raw) => {
        const list = normalizeTaskList(raw);
        setUsers(list as unknown as User[]);
      })
      .catch(() => setUsers([]));
  }, []);

  /* initial board */
  useEffect(() => { fetchFilter("team"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadContactTasks = useCallback(
    (cid: string, label: string) => {
      setApiLoading(true);
      taskApi.getTasks(cid)
        .then((raw) => {
          const tasks = normalizeTaskList(raw);
          setColumns(tasks.length ? toColumns(tasks) : EMPTY_COLS);
          showToast(
            tasks.length
              ? `Loaded ${tasks.length} task${tasks.length !== 1 ? "s" : ""} for ${label}`
              : `No tasks for ${label}`,
            tasks.length ? "success" : "info",
          );
        })
        .catch((err: Error) => { showToast(`Failed: ${err.message}`, "error"); setColumns(EMPTY_COLS); })
        .finally(() => setApiLoading(false));
    },
    [showToast],
  );

  const fetchFilter = async (filter: FilterKey) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
      if (contactId) loadContactTasks(contactId, contactName ?? "");
      return;
    }
    setActiveFilter(filter);
    setFilterLoading(true);
    try {
      const raw =
        filter === "today"    ? await taskApi.getToday() :
        filter === "overdue"  ? await taskApi.getOverdue() :
        filter === "team"     ? await taskApi.getTeamTasks() :
                                await taskApi.getMyTasks();
      const tasks = normalizeTaskList(raw);
      setColumns(tasks.length ? toColumns(tasks) : EMPTY_COLS);
      showToast(
        tasks.length ? `Loaded ${tasks.length} task(s)` : `No tasks for "${filter}"`,
        tasks.length ? "success" : "info",
      );
    } catch (err: unknown) {
      showToast(`Filter failed: ${(err as Error).message}`, "error");
    } finally {
      setFilterLoading(false);
    }
  };

  const handleSelectContact = (c: Contact) => {
    const id = safeId(c.id ?? c._id);
    setContactId(id);
    setContactName(c.name);
    setActiveFilter(null);
    loadContactTasks(id, c.name);
  };

  /* Drag end within a column → reorder only, no status API call */
  const handleDragEnd = useCallback((colId: StatusKey, newCards: TaskCard[]) => {
    setColumns((prev) =>
      prev.map((col) => col.id === colId ? { ...col, cards: newCards } : col),
    );
  }, []);

  const openAdd = (colId: StatusKey) => {
    if (!contactId) { showToast("Select a contact first", "info"); setContactModal(true); return; }
    setEditCard(null);
    setActiveColId(colId);
    setTaskFormModal(true);
  };

  const openEdit = (card: TaskCard) => {
    setEditCard(card);
    setActiveColId(card.status);
    setTaskFormModal(true);
  };

  const saveCard = async (data: FormState & { cardKey: string }) => {
    const status = data.colId;
    const effectiveCid = editCard?.contactId ?? contactId;
    if (!effectiveCid) { showToast("Select a contact before saving", "error"); return; }

    const payload = {
      title:          data.title,
      description:    data.description,
      assignedUserId: data.assignedUserId ? Number(data.assignedUserId) : null,
      dueAt:          toDueAt(data.date),
    };

    setTaskSaving(true);
    try {
      if (editCard) {
        const tid = editCard.id ?? editCard._id;
        if (tid == null) throw new Error("Task has no id");
        const updated = await taskApi.updateTask(effectiveCid, tid, payload);
        if (status !== editCard.status) {
          await taskApi.updateStatus(effectiveCid, tid, status);
        }
        const serverDueAt = (updated as Task).dueAt;
        const merged: TaskCard = {
          ...editCard,
          title:       data.title,
          description: data.description,
          priority:    data.priority,
          tags:        data.tags,
          date:        data.date,
          dueAt:       serverDueAt ?? editCard.dueAt,
          status,
        };
        setColumns((prev) =>
          prev.map((col) => {
            const without = col.cards.filter((c) => c.key !== editCard.key);
            return col.id === status ? { ...col, cards: [...without, merged] } : { ...col, cards: without };
          }),
        );
        showToast("Task updated");
      } else {
        const created = await taskApi.createTask(effectiveCid, payload);
        const createdTask = created as Task & Record<string, unknown>;
        if (status !== "OPEN" && (createdTask.id ?? createdTask._id) != null) {
          await taskApi.updateStatus(effectiveCid, createdTask.id ?? createdTask._id!, status);
        }
        const newCard: TaskCard = {
          ...taskToCard(createdTask),
          key:          safeId(createdTask.id ?? createdTask._id),
          priority:     data.priority,
          tags:         data.tags,
          date:         data.date,
          status,
          contactId:    typeof effectiveCid === "string" ? effectiveCid : String(effectiveCid),
          contactName:  contactName ?? undefined,
        };
        setColumns((prev) =>
          prev.map((col) => col.id === status ? { ...col, cards: [...col.cards, newCard] } : col),
        );
        showToast("Task created");
      }
    } catch (err: unknown) {
      showToast(`Save failed: ${(err as Error).message}`, "error");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleDelete = async (card: TaskCard) => {
    const cid = card.contactId ?? contactId;
    const tid = card.id ?? card._id;
    if (!cid || tid == null) { showToast("Cannot delete: missing id", "error"); return; }
    try {
      await taskApi.deleteTask(cid, tid);
      setColumns((prev) =>
        prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.key !== card.key) })),
      );
      showToast("Task deleted");
    } catch (err: unknown) {
      showToast(`Delete failed: ${(err as Error).message}`, "error");
    }
  };

  /* Search filter — applied at render time, no state mutation */
  const filteredCols: KanbanColumn[] = columns.map((col) => ({
    ...col,
    cards: search
      ? col.cards.filter((c) => {
          const q = search.toLowerCase();
          return (
            c.title.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            c.contactName?.toLowerCase().includes(q) ||
            c.assignedUserEmail?.toLowerCase().includes(q)
          );
        })
      : col.cards,
  }));

  const total = columns.reduce((acc, col) => acc + col.cards.length, 0);

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}><Text style={{ color: "#fff", fontSize: 14 }}>✓</Text></View>
          <View>
            <Text style={styles.headerTitle}>TaskBoard</Text>
            <Text style={styles.headerSub}>
              {apiLoading ? "Loading…" : `${total} task${total !== 1 ? "s" : ""} · ${columns.length} cols`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setContactModal(true)}
          style={[styles.contactBtn, contactId && { borderColor: "#0f766e", backgroundColor: "#f0fdfa" }]}
        >
          <Text style={{ fontSize: 12 }}>👤</Text>
          <Text style={[styles.contactBtnText, contactId ? { color: "#0f766e" } : null]} numberOfLines={1}>
            {contactName ?? "Select Contact"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={{ color: "#94a3b8", marginRight: 6 }}>🔍</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search tasks…"
          placeholderTextColor="#94a3b8"
          style={styles.searchBarInput}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: "#94a3b8" }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading indicator */}
      {(apiLoading || filterLoading) && (
        <View style={{ alignItems: "center", paddingVertical: 4 }}>
          <ActivityIndicator size="small" color="#0f766e" />
        </View>
      )}

      {/* Filter pills */}
      <FilterPills active={activeFilter} loading={filterLoading} onSelect={fetchFilter} />

      {/* Board */}
      {!contactId && !activeFilter && !apiLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📋</Text>
          <Text style={styles.emptyStateTitle}>Select a Contact</Text>
          <Text style={styles.emptyStateSub}>
            Pick a contact or use a filter above to load tasks
          </Text>
          <TouchableOpacity onPress={() => setContactModal(true)} style={styles.cta}>
            <Text style={styles.ctaText}>Choose Contact →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <BoardScrollWrapper>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.board}
          >
            {filteredCols.map((col) => (
              <KanbanColumnView
                key={col.id}
                col={col}
                onAddCard={openAdd}
                onEditCard={openEdit}
                onDeleteCard={handleDelete}
                onDragEnd={handleDragEnd}
              />
            ))}
          </ScrollView>
        </BoardScrollWrapper>
      )}

      {/* Modals */}
      <ContactPickerModal
        visible={contactModal}
        onClose={() => setContactModal(false)}
        onSelect={handleSelectContact}
      />
      <TaskFormModal
        visible={taskFormModal}
        onClose={() => setTaskFormModal(false)}
        onSave={saveCard}
        initial={editCard}
        colId={activeColId}
        columns={columns}
        users={users}
        loading={taskSaving}
      />

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#0f172a",
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBox:     { width: 34, height: 34, borderRadius: 10, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: -0.5 },
  headerSub:   { color: "#64748b", fontSize: 11, marginTop: 1 },
  contactBtn:  {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: "#334155", backgroundColor: "#1e293b", maxWidth: 160,
  },
  contactBtnText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchBarInput: { flex: 1, fontSize: 13, color: "#0f172a" },

  filterBar: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  filterPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1,
  },

  board: { padding: 16, gap: 12, alignItems: "flex-start" as const },

  column: {
    width: 280, backgroundColor: "#fff", borderRadius: 16, padding: 12,
    borderTopWidth: 3, borderTopColor: "#e2e8f0",
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  columnHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 6 },
  colName:      { fontSize: 11, fontWeight: "800", color: "#0f172a", textTransform: "uppercase", letterSpacing: 1, flex: 1 },
  colCount:     { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  colCountText: { fontSize: 10, fontWeight: "800" },
  emptyCol:     { padding: 20, alignItems: "center", borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#e2e8f0", marginVertical: 4 },
  emptyColText: { color: "#cbd5e1", fontSize: 12 },
  addMoreBtn:   { marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center" },
  addMoreText:  { fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginVertical: 4,
    borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 3,
  },
  cardActive: {
    borderColor: "#0f766e", backgroundColor: "#f0fdfa",
    ...Platform.select({
      ios:     { shadowColor: "#0f766e", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  cardHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 4 },
  dragIcon:    { fontSize: 16, color: "#94a3b8", letterSpacing: -2, paddingHorizontal: 2 },
  cardId:      { fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  cardAction:  { padding: 4, borderRadius: 6, backgroundColor: "#f1f5f9" },
  cardTitle:   { fontSize: 13, fontWeight: "800", color: "#0f172a", marginBottom: 8, lineHeight: 18 },
  cardDesc:    { fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 17 },

  infoChip: { backgroundColor: "#f1f5f9", borderRadius: 8, padding: 8, marginBottom: 8, gap: 3 },
  infoRow:  { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  infoLabel:{ fontSize: 10, color: "#94a3b8", fontWeight: "600" },
  infoValue:{ fontSize: 10, color: "#0f172a", fontWeight: "700", flex: 1, textAlign: "right" },

  tagsRow:      { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  tagBadge:     { backgroundColor: "#f0fdfa", borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#99f6e4" },
  tagBadgeText: { fontSize: 9, color: "#0f766e", fontWeight: "700" },
  tagMore:      { fontSize: 10, color: "#94a3b8", alignSelf: "center" },

  cardFooter:  { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  priBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  priBadgeText:{ fontSize: 10, fontWeight: "700" },
  dueLabel:    { fontSize: 10, fontWeight: "700" },
  dateText:    { fontSize: 10, color: "#94a3b8" },

  dot: { width: 7, height: 7, borderRadius: 4 },

  emptyState:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyStateIcon:  { fontSize: 56 },
  emptyStateTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  emptyStateSub:   { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 },
  cta:             { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: "#0f766e" },
  ctaText:         { color: "#fff", fontWeight: "800", fontSize: 14 },

  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  modalClose: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },

  searchInput: {
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: "#0f172a",
  },
  contactRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  avatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0f766e", alignItems: "center", justifyContent: "center" },
  avatarText:  { color: "#fff", fontWeight: "800", fontSize: 13 },
  contactName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  contactSub:  { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },

  fieldLabel:  { fontSize: 10, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 6 },
  input:       { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#0f172a" },
  inputError:  { borderColor: "#ef4444" },
  errorText:   { fontSize: 11, color: "#ef4444", marginTop: 4 },
  priorityBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5 },
  chip:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  tagChip:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1 },
  saveBtn:     { marginTop: 20, backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  toast: {
    position: "absolute", bottom: 24, left: 16, right: 16,
    padding: 14, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", alignItems: "center", zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: "#000", shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
});