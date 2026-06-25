import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalTask {
  id: string | number;
  title: string;
  status: string;
  priority?: string;
  dueAt?: string;
  contactName?: string;
}

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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
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

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "#ef4444", URGENT: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
};

const STATUS_DONE = new Set(["COMPLETED", "DONE", "CLOSED", "RESOLVED"]);

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day, isToday, isSelected, dotCount, onPress,
}: {
  day: number; isToday: boolean; isSelected: boolean; dotCount: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.dayCell} onPress={onPress} activeOpacity={0.7}>
      <View style={[
        s.dayCircle,
        isToday && s.dayCircleToday,
        isSelected && s.dayCircleSelected,
      ]}>
        <Text style={[
          s.dayNum,
          isToday && s.dayNumToday,
          isSelected && s.dayNumSelected,
        ]}>
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date>(today);
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const endpoints = ["/api/tasks/my-tasks", "/api/tasks"];
      let data: any[] = [];
      for (const url of endpoints) {
        try {
          const res = await api.get(url, { params: { size: 500 } });
          data = normalizeList(res.data);
          break;
        } catch { /* try next */ }
      }
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]));

  // Build a map: "YYYY-MM-DD" → task count
  const tasksByDay = React.useMemo(() => {
    const map: Record<string, CalTask[]> = {};
    for (const t of tasks) {
      if (!t.dueAt) continue;
      try {
        const d = new Date(t.dueAt);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(t);
      } catch { /* ignore */ }
    }
    return map;
  }, [tasks]);

  function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // Build calendar grid for current month
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = startOfMonth(cursor).getDay(); // 0=Sun
  const totalDays = daysInMonth(year, month);

  const selectedDayTasks = tasksByDay[dayKey(selected)] ?? [];
  const pendingTasks = selectedDayTasks.filter(t => !STATUS_DONE.has((t.status || "").toUpperCase()));
  const doneTasks   = selectedDayTasks.filter(t =>  STATUS_DONE.has((t.status || "").toUpperCase()));

  // All upcoming tasks (no due date or future due date, not done)
  const upcoming = tasks
    .filter(t => {
      if (STATUS_DONE.has((t.status || "").toUpperCase())) return false;
      if (!t.dueAt) return true;
      try { return new Date(t.dueAt) >= today; } catch { return true; }
    })
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    })
    .slice(0, 20);

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }

  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <SafeAreaView edges={["bottom"]} style={s.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTasks(); }}
            tintColor="#0f766e"
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Month navigator ── */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthTitle}>{fmtMonthYear(cursor)}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Calendar grid ── */}
        <View style={s.calCard}>
          {/* Weekday headers */}
          <View style={s.weekRow}>
            {WEEKDAYS.map(d => (
              <Text key={d} style={s.weekDay}>{d}</Text>
            ))}
          </View>

          {/* Day cells */}
          {loading ? (
            <ActivityIndicator color="#0f766e" style={{ marginVertical: 24 }} />
          ) : (
            <View style={s.grid}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <View key={`e${i}`} style={s.dayCell} />
              ))}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const isToday = sameDay(date, today);
                const isSelected = sameDay(date, selected);
                const count = (tasksByDay[dayKey(date)] ?? []).length;
                return (
                  <DayCell
                    key={day}
                    day={day}
                    isToday={isToday}
                    isSelected={isSelected}
                    dotCount={count}
                    onPress={() => setSelected(date)}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* ── Selected day tasks ── */}
        <Text style={s.sectionHeader}>
          {selected.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          {"  "}
          <Text style={{ color: "#0f766e" }}>
            {selectedDayTasks.length > 0 ? `${selectedDayTasks.length} task${selectedDayTasks.length > 1 ? "s" : ""}` : "No tasks"}
          </Text>
        </Text>

        {selectedDayTasks.length === 0 && (
          <Text style={s.emptyText}>Nothing scheduled for this day.</Text>
        )}

        {pendingTasks.map(t => <TaskCard key={t.id} task={t} />)}
        {doneTasks.map(t => <TaskCard key={t.id} task={t} done />)}

        {/* ── Upcoming tasks ── */}
        {upcoming.length > 0 && (
          <>
            <Text style={s.sectionHeader}>UPCOMING</Text>
            {upcoming.map(t => <TaskCard key={t.id} task={t} showDate />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, done, showDate }: { task: CalTask; done?: boolean; showDate?: boolean }) {
  const pc = PRIORITY_COLOR[(task.priority || "").toUpperCase()] ?? "#94a3b8";
  return (
    <View style={[s.taskCard, done && s.taskCardDone]}>
      <View style={[s.priorityBar, { backgroundColor: pc }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.taskTitle, done && s.taskTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        <View style={s.taskMeta}>
          {task.contactName && (
            <Text style={s.taskMetaText}>👤 {task.contactName}</Text>
          )}
          {showDate && task.dueAt && (
            <Text style={s.taskMetaText}>
              📅 {new Date(task.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {fmtTime(task.dueAt) ? `  ${fmtTime(task.dueAt)}` : ""}
            </Text>
          )}
          {!showDate && task.dueAt && fmtTime(task.dueAt) && (
            <Text style={s.taskMetaText}>🕐 {fmtTime(task.dueAt)}</Text>
          )}
        </View>
      </View>
      <View style={[s.statusBadge, done && s.statusBadgeDone]}>
        <Text style={[s.statusText, done && s.statusTextDone]}>
          {done ? "DONE" : (task.status || "OPEN").toUpperCase()}
        </Text>
      </View>
    </View>
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
    backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 16,
    padding: 12, elevation: 2, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700",
    color: "#94a3b8", paddingVertical: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },

  dayCell: {
    width: `${100 / 7}%` as any,
    alignItems: "center", paddingVertical: 4,
  },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
  dayCircleToday: { backgroundColor: "#f0fdfa" },
  dayCircleSelected: { backgroundColor: "#0f766e" },
  dayNum: { fontSize: 14, color: "#374151" },
  dayNumToday: { color: "#0f766e", fontWeight: "700" },
  dayNumSelected: { color: "#fff", fontWeight: "700" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#0f766e" },

  sectionHeader: {
    fontSize: 12, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  emptyText: {
    fontSize: 13, color: "#94a3b8", paddingHorizontal: 16, paddingBottom: 8,
  },

  taskCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8,
    borderRadius: 12, padding: 12, elevation: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  taskCardDone: { opacity: 0.55 },
  priorityBar: { width: 3, height: 40, borderRadius: 2 },
  taskTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b", marginBottom: 4 },
  taskTitleDone: { textDecorationLine: "line-through", color: "#94a3b8" },
  taskMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  taskMetaText: { fontSize: 12, color: "#64748b" },
  statusBadge: {
    backgroundColor: "#f0fdfa", borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusBadgeDone: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 10, fontWeight: "700", color: "#0f766e" },
  statusTextDone: { color: "#94a3b8" },
});
