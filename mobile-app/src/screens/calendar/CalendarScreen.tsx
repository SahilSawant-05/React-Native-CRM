import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

// Platform typography helpers (styling only)
const MEDIUM_FONT = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const LS_LG = Platform.OS === "ios" ? -0.32 : 0; // 15-16pt
const LS_SM = Platform.OS === "ios" ? -0.15 : 0; // 13-14pt

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string | number;
  title: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  categoryId?: number;
  categoryKey?: string;
  category?: any;
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

// Returns the device's local UTC offset as "+05:30" / "-08:00", which is
// what java.time.OffsetDateTime requires on the backend.
function localOffset(): string {
  const offsetMin = -new Date().getTimezoneOffset(); // JS gives inverted sign
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function buildStartAt(date: Date, timeStr: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = timeStr || "09:00";
  return `${dateStr}T${time}:00${localOffset()}`;
}

function getCategoryById(id: number) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];
}

// Resolves the category for an event no matter which shape the API
// returned it in. Previously callers only checked `event.categoryId`, so
// any response that nested the category (e.g. `category: { id, key }`)
// or used a different field name (`categoryKey`) fell through to a
// hardcoded default and every event rendered as "Planning".
function resolveCategory(event: CalEvent) {
  const rawId =
    event.categoryId ??
    event.category?.id ??
    event.category?.categoryId;

  if (rawId != null) {
    const byId = CATEGORIES.find(c => c.id === Number(rawId));
    if (byId) return byId;
  }

  const rawKey =
    event.categoryKey ??
    event.category?.key ??
    event.category?.name ??
    (typeof event.category === "string" ? event.category : undefined);

  if (rawKey) {
    const byKey = CATEGORIES.find(
      c => c.key.toLowerCase() === String(rawKey).toLowerCase()
        || c.name.toLowerCase() === String(rawKey).toLowerCase()
    );
    if (byKey) return byKey;
  }

  return CATEGORIES[0];
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
  const cat = resolveCategory(event);
  return (
    <View style={s.taskCard}>
      <View style={[s.priorityBar, { backgroundColor: cat.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.taskTitle} numberOfLines={2}>{event.title}</Text>
        <View style={s.taskMeta}>
          {showDate && event.startAt && (
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
              <Text style={s.taskMetaText}>
                {new Date(event.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {fmtTime(event.startAt) ? `  ${fmtTime(event.startAt)}` : ""}
              </Text>
            </View>
          )}
          {!showDate && event.startAt && fmtTime(event.startAt) && (
            <View style={s.metaItem}>
              <Ionicons name="time-outline" size={13} color="#9ca3af" />
              <Text style={s.taskMetaText}>{fmtTime(event.startAt)}</Text>
            </View>
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

      // Send description as "" instead of null/omitted — many Spring DTOs
      // reject a missing field even when it's logically optional. This is
      // a defensive guess; the console.log below will show us if the
      // real 400 reason is something else entirely.
      // Web parity (Events.jsx handleSave): the backend keys the category off
      // the `category` KEY string (e.g. "MEETING"), not `categoryId`. Sending
      // categoryId was ignored server-side so every event fell back to
      // Planning. Send the key (and categoryId too, harmlessly, for any DTO
      // that reads it) plus the SCHEDULED status the web sends.
      const category = getCategoryById(categoryId);
      const payload: Record<string, any> = {
        title: title.trim(),
        startAt,
        allDay,
        category: category.key,
        categoryId,
        status: "SCHEDULED",
        description: description.trim(),
      };

      if (!allDay) payload.endAt = buildStartAt(defaultDate, endTime);

      console.log("[CreateEvent] POST /api/events payload:", JSON.stringify(payload, null, 2));
      await api.post("/api/events", payload);
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      const data = e?.response?.data;
      console.log("[CreateEvent] error response body:", JSON.stringify(data, null, 2));

      // Try the common shapes Spring Boot / Jakarta validation errors come back as.
      const fieldErrors =
        data?.errors?.map((er: any) => `${er.field ?? er.objectName ?? ""}: ${er.defaultMessage ?? er.message ?? ""}`) ??
        data?.fieldErrors?.map((er: any) => `${er.field}: ${er.defaultMessage}`) ??
        (Array.isArray(data?.violations) ? data.violations.map((v: any) => `${v.field ?? v.property ?? ""}: ${v.message}`) : null);

      const detail =
        (fieldErrors && fieldErrors.length ? fieldErrors.join("\n") : null) ??
        data?.message ??
        data?.error ??
        (typeof data === "string" ? data : null) ??
        e?.message ??
        "Failed to create event";

      // 409 = calendar conflict (web parity: Events.jsx surfaces a "Calendar
      // conflict:" banner). The event overlaps another scheduled event for the
      // assignee — show the backend's reason and let the user pick another
      // time rather than a generic failure.
      if (e?.response?.status === 409) {
        Alert.alert(
          "Scheduling conflict",
          detail && detail !== "Failed to create event"
            ? detail
            : "This time overlaps another scheduled event. Please choose a different time.",
        );
      } else {
        Alert.alert("Error", detail);
      }
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
          <View style={s.modalHeaderRow}>
            <Text style={s.modalTitle}>New Event</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn} hitSlop={8}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
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
                  style={[s.pill, categoryId === cat.id && { backgroundColor: cat.bg }]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[s.pillText, categoryId === cat.id && { color: cat.color }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* All Day toggle */}
            <TouchableOpacity style={s.allDayRow} onPress={() => setAllDay(v => !v)} activeOpacity={0.7}>
              <View style={[s.checkbox, allDay && s.checkboxOn]}>
                {allDay && <Ionicons name="checkmark" size={15} color="#fff" />}
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
  // Month/year jump picker (web parity): tap the title to pick any month/year
  // instead of stepping one month at a time.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());

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
    <SafeAreaView edges={[]} style={s.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor="#0f766e" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Month navigator ── */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month - 1, 1))} style={s.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color="#0f766e" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.monthTitleBtn}
            onPress={() => { setPickerYear(year); setPickerOpen(true); }}
            activeOpacity={0.7}
          >
            <Text style={s.monthTitle}>{fmtMonthYear(cursor)}</Text>
            <Ionicons name="chevron-down" size={16} color="#0f766e" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCursor(new Date(year, month + 1, 1))} style={s.navBtn} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color="#0f766e" />
          </TouchableOpacity>
        </View>

        {/* Quick "jump to today" */}
        {(year !== today.getFullYear() || month !== today.getMonth()) && (
          <TouchableOpacity
            style={s.todayBtn}
            onPress={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(today); }}
            activeOpacity={0.8}
          >
            <Ionicons name="today-outline" size={14} color="#0f766e" />
            <Text style={s.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}

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
        </View>

        {selectedDayEvents.length === 0 && (
          <Text style={s.emptyText}>Nothing scheduled — tap + to add an event.</Text>
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

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <CreateEventModal
        visible={showCreate}
        defaultDate={selected}
        onClose={() => setShowCreate(false)}
        onCreated={fetchEvents}
      />

      {/* ── Month / Year picker ── */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={s.pickerSheet} onStartShouldSetResponder={() => true}>
            {/* Year stepper */}
            <View style={s.pickerYearRow}>
              <TouchableOpacity onPress={() => setPickerYear(y => y - 1)} style={s.navBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color="#0f766e" />
              </TouchableOpacity>
              <Text style={s.pickerYearText}>{pickerYear}</Text>
              <TouchableOpacity onPress={() => setPickerYear(y => y + 1)} style={s.navBtn} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color="#0f766e" />
              </TouchableOpacity>
            </View>

            {/* Month grid */}
            <View style={s.pickerMonthGrid}>
              {MONTHS_SHORT.map((label, m) => {
                const isCurrent = m === month && pickerYear === year;
                const isThisMonth = m === today.getMonth() && pickerYear === today.getFullYear();
                return (
                  <TouchableOpacity
                    key={label}
                    style={[s.pickerMonthCell, isCurrent && s.pickerMonthCellActive]}
                    onPress={() => {
                      setCursor(new Date(pickerYear, m, 1));
                      setPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      s.pickerMonthText,
                      isCurrent && s.pickerMonthTextActive,
                      !isCurrent && isThisMonth && s.pickerMonthTextToday,
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },

  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  monthTitleBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 },
  monthTitle: {
    fontSize: 17, fontWeight: "600", color: "#111827",
    fontFamily: MEDIUM_FONT, letterSpacing: LS_LG,
  },
  todayBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "center",
    marginTop: -4, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1, borderColor: "#5eead4", backgroundColor: "#f0fdfa",
  },
  todayBtnText: { fontSize: 12, fontWeight: "700", color: "#0f766e" },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 28 },
  pickerSheet: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 14 },
  pickerYearRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerYearText: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  pickerMonthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerMonthCell: {
    width: "22%", flexGrow: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, borderRadius: 10, backgroundColor: "#f1f5f9",
  },
  pickerMonthCellActive: { backgroundColor: "#0f766e" },
  pickerMonthText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  pickerMonthTextActive: { color: "#fff", fontWeight: "800" },
  pickerMonthTextToday: { color: "#0f766e", fontWeight: "800" },

  calCard: {
    backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 14, padding: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#9ca3af",
    paddingVertical: 4, textTransform: "uppercase", letterSpacing: 0.5,
    fontFamily: MEDIUM_FONT,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },

  dayCell: { width: `${100 / 7}%` as any, alignItems: "center", paddingVertical: 4 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: "#0f766e" },
  dayCircleSelected: { backgroundColor: "#0f766e", borderWidth: 0 },
  dayNum: { fontSize: 14, color: "#374151", fontFamily: MEDIUM_FONT, letterSpacing: LS_SM },
  dayNumToday: { color: "#0f766e", fontWeight: "600" },
  dayNumSelected: { color: "#fff", fontWeight: "600" },
  dotRow: { flexDirection: "row", gap: 3, marginTop: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#0f766e" },

  dayHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
  },
  dayHeaderText: {
    fontSize: 13, fontWeight: "600", color: "#6b7280", flex: 1,
    fontFamily: MEDIUM_FONT, letterSpacing: LS_SM,
  },

  sectionHeader: {
    fontSize: 11, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase",
    letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
    fontFamily: MEDIUM_FONT,
  },
  emptyText: { fontSize: 13, color: "#9ca3af", paddingHorizontal: 16, paddingBottom: 8, letterSpacing: LS_SM },

  taskCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, padding: 14, elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  priorityBar: { width: 3.5, height: 40, borderRadius: 2 },
  taskTitle: {
    fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 4,
    fontFamily: MEDIUM_FONT, letterSpacing: LS_SM,
  },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  taskMetaText: { fontSize: 12, color: "#6b7280" },
  statusBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.4, fontFamily: MEDIUM_FONT },

  fab: {
    position: "absolute", right: 16, bottom: 16,
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#0f766e",
    alignItems: "center", justifyContent: "center",
    elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },

  // Modal
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 12, paddingBottom: 36, maxHeight: "85%",
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#d1d5db",
    alignSelf: "center", marginBottom: 16,
  },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: {
    fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 2,
    fontFamily: MEDIUM_FONT, letterSpacing: LS_LG,
  },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(118,118,128,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  modalSub: { fontSize: 13, color: "#6b7280", marginBottom: 20, letterSpacing: LS_SM },
  fieldLabel: {
    fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 0.4, fontFamily: MEDIUM_FONT,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(60,60,67,0.2)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827",
    marginBottom: 16, backgroundColor: "rgba(118,118,128,0.06)", letterSpacing: LS_LG,
  },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  pill: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99,
    backgroundColor: "rgba(118,118,128,0.06)", alignItems: "center",
  },
  pillText: { fontSize: 12.5, fontWeight: "600", color: "#6b7280", fontFamily: MEDIUM_FONT },
  allDayRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "rgba(60,60,67,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  allDayLabel: { fontSize: 14, fontWeight: "500", color: "#374151", letterSpacing: LS_SM },
  saveBtn: {
    backgroundColor: "#0f766e", borderRadius: 12, height: 48,
    alignItems: "center", justifyContent: "center", marginTop: 8,
  },
  saveBtnText: {
    color: "#fff", fontWeight: "600", fontSize: 15,
    fontFamily: MEDIUM_FONT, letterSpacing: LS_LG,
  },
});