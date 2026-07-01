import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string | number;
  title: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  categoryId?: number;
  categoryKey?: string;
  description?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 1, key: "PLANNING",  name: "Planning",  color: "#22c55e", bg: "#f0fdf4" },
  { id: 2, key: "MEETING",   name: "Meeting",   color: "#3b82f6", bg: "#eff6ff" },
  { id: 3, key: "REPORTING", name: "Reporting", color: "#f59e0b", bg: "#fffbeb" },
  { id: 4, key: "DESIGN",    name: "Design",    color: "#ef4444", bg: "#fef2f2" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function buildStartAt(date: Date, timeStr: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = timeStr || "09:00";
  return `${dateStr}T${time}:00`;
}

function getCategoryById(id: number) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── DayCell ─────────────────────────────────────────────────────────────────

function DayCell({ day, isToday, isSelected, dotCount, onPress }: {
  day: number; isToday: boolean; isSelected: boolean; dotCount: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.dayCell} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.dayCircle, isToday && s.dayCircleToday, isSelected && s.dayCircleSelected]}>
        <Text style={[s.dayNum, isToday && s.dayNumToday, isSelected && s.dayNumSelected]}>
          {day}
        </Text>
      </View>
      {dotCount > 0 && (
        <View style={s.dotRow}>
          {Array.from({ length: Math.min(dotCount, 3) }).map((_, i) => (
            <View key={i} style={s.dot} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ event, showDate }: { event: CalEvent; showDate?: boolean }) {
  const cat = getCategoryById(event.categoryId ?? 1);
  return (
    <View style={s.taskCard}>
      <View style={[s.priorityBar, { backgroundColor: cat.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.taskTitle} numberOfLines={2}>{event.title}</Text>
        <View style={s.taskMeta}>
          {showDate && event.startAt && (
            <Text style={s.taskMetaText}>
              📅 {new Date(event.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {fmtTime(event.startAt) ? `  ${fmtTime(event.startAt)}` : ""}
            </Text>
          )}
          {!showDate && event.startAt && fmtTime(event.startAt) && (
            <Text style={s.taskMetaText}>🕐 {fmtTime(event.startAt)}</Text>
          )}
          {!!event.description && (
            <Text style={s.taskMetaText} numberOfLines={1}>{event.description}</Text>
          )}
        </View>
      </View>
      <View style={[s.statusBadge, { backgroundColor: cat.bg }]}>
        <Text style={[s.statusText, { color: cat.color }]}>{cat.name.toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ─── CreateEventModal ─────────────────────────────────────────────────────────

function CreateEventModal({ visible, defaultDate, onClose, onCreated }: {
  visible: boolean;
  defaultDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState(1);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(""); setStartTime("09:00"); setEndTime("10:00");
    setAllDay(false); setCategoryId(1); setDescription("");
  }

  async function save() {
    if (!title.trim()) { Alert.alert("Required", "Please enter an event title."); return; }
    setSaving(true);
    try {
      const startAt = buildStartAt(defaultDate, startTime);
      const endAt = allDay ? null : buildStartAt(defaultDate, endTime);
      await api.post("/api/events", {
        title: title.trim(),
        startAt,
        endAt,
        allDay,
        categoryId,
        description: description.trim() || null,
        assignedUserId: null,
      });
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.message || e?.message || "Failed to create event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={s.modalScrim} activeOpacity={1} onPress={onClose} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>New Event</Text>
          <Text style={s.modalSub}>
            {defaultDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="Event title"
              placeholderTextColor="#94a3b8"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />

            <Text style={s.fieldLabel}>Category</Text>
            <View style={s.pillRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.pill, categoryId === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[s.pillText, categoryId === cat.id && s.pillTextOn]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* All Day toggle */}
            <TouchableOpacity style={s.allDayRow} onPress={() => setAllDay(v => !v)} activeOpacity={0.7}>
              <View style={[s.checkbox, allDay && s.checkboxOn]}>
                {allDay && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.allDayLabel}>All day</Text>
            </TouchableOpacity>

            {!allDay && (
              <>
                <Text style={s.fieldLabel}>Start Time (HH:MM)</Text>
                <TextInput
                  style={s.input}
                  placeholder="09:00"
                  placeholderTextColor="#94a3b8"
                  value={startTime}
                  onChangeText={setStartTime}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={s.fieldLabel}>End Time (HH:MM)</Text>
                <TextInput
                  style={s.input}
                  placeholder="10:00"
                  placeholderTextColor="#94a3b8"
                  value={endTime}
                  onChangeText={setEndTime}
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            <Text style={s.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: "top" }]}
              placeholder="Add details…"
              placeholderTextColor="#94a3b8"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>Create Event</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/api/events", { params: { size: 500 } });
      setEvents(normalizeList(res.data));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]));

  const eventsByDay = React.useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events) {
      if (!e.startAt) continue;
      try {
        const d = new Date(e.startAt);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(e);
      } catch { /* ignore */ }
    }
    return map;
  }, [events]);

  function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);

  const selectedDayEvents = eventsByDay[dayKey(selected)] ?? [];

  const upcoming = events
    .filter(e => {
      if (!e.startAt) return false;
      try { return new Date(e.startAt) >= today; } catch { return false; }
    })
    .sort((a, b) => {
      if (!a.startAt) return 1;
      if (!b.startAt) return -1;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    })
    .slice(0, 20);

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor="#0f766e" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Month navigator ── */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} style={s.navBtn}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthTitle}>{fmtMonthYear(cursor)}</Text>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} style={s.navBtn}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Calendar grid ── */}
        <View style={s.calCard}>
          <View style={s.weekRow}>
            {WEEKDAYS.map(d => <Text key={d} style={s.weekDay}>{d}</Text>)}
          </View>

          {loading ? (
            <ActivityIndicator color="#0f766e" style={{ marginVertical: 24 }} />
          ) : (
            <View style={s.grid}>
              {Array.from({ length: firstDow }).map((_, i) => <View key={`e${i}`} style={s.dayCell} />)}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                return (
                  <DayCell
                    key={day}
                    day={day}
                    isToday={sameDay(date, today)}
                    isSelected={sameDay(date, selected)}
                    dotCount={(eventsByDay[dayKey(date)] ?? []).length}
                    onPress={() => setSelected(date)}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── Selected day header + Create button ── */}
        <View style={s.dayHeaderRow}>
          <Text style={s.dayHeaderText}>
            {selected.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            {selectedDayEvents.length > 0
              ? `  ·  ${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? "s" : ""}`
              : ""}
          </Text>
          <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={s.createBtnText}>+ Event</Text>
          </TouchableOpacity>
        </View>

        {selectedDayEvents.length === 0 && (
          <Text style={s.emptyText}>Nothing scheduled — tap + Event to add one.</Text>
        )}
        {selectedDayEvents.map(e => <EventCard key={e.id} event={e} />)}

        {/* ── Upcoming ── */}
        {upcoming.length > 0 && (
          <>
            <Text style={s.sectionHeader}>UPCOMING</Text>
            {upcoming.map(e => <EventCard key={e.id} event={e} showDate />)}
          </>
        )}
      </ScrollView>

      <CreateEventModal
        visible={showCreate}
        defaultDate={selected}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEvents}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 28, color: "#0f766e", fontWeight: "600", lineHeight: 30 },
  monthTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },

  calCard: {
    backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 16, padding: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#94a3b8", paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },

  dayCell: { width: `${100 / 7}%` as any, alignItems: "center", paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { backgroundColor: "#f0fdfa" },
  dayCircleSelected: { backgroundColor: "#0f766e" },
  dayNum: { fontSize: 14, color: "#374151" },
  dayNumToday: { color: "#0f766e", fontWeight: "700" },
  dayNumSelected: { color: "#fff", fontWeight: "700" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#0f766e" },

  dayHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  dayHeaderText: { fontSize: 13, fontWeight: "700", color: "#0f766e", flex: 1 },
  createBtn: {
    backgroundColor: "#0f766e", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  createBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  sectionHeader: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  emptyText: { fontSize: 13, color: "#94a3b8", paddingHorizontal: 16, paddingBottom: 8 },

  taskCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, padding: 12, elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  priorityBar: { width: 3, height: 40, borderRadius: 2 },
  taskTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  taskMetaText: { fontSize: 12, color: "#64748b" },
  statusBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "700" },

  // Modal
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36, maxHeight: "85%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0",
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 2 },
  modalSub: { fontSize: 13, color: "#64748b", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
  input: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0f172a",
    marginBottom: 16, backgroundColor: "#f8fafc",
  },
  pillRow: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  pill: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1,
    borderColor: "#e2e8f0", alignItems: "center",
  },
  pillText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  pillTextOn: { color: "#fff" },
  allDayRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#d1d5db",
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  allDayLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  saveBtn: { backgroundColor: "#0f766e", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
