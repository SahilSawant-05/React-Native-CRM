import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchMyTasks, updateTaskStatus } from "../../api/tasks";
import { Task } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  HIGH: { bg: "#fef2f2", text: "#b91c1c" },
  MEDIUM: { bg: "#fffbeb", text: "#92400e" },
  LOW: { bg: "#f1f5f9", text: "#475569" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: "#dcfce7", text: "#166534" },
  IN_PROGRESS: { bg: "#eff6ff", text: "#1d4ed8" },
  PENDING: { bg: "#f1f5f9", text: "#475569" },
};

function TaskCard({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string | number, newStatus: string) => void;
}) {
  const pc = PRIORITY_COLORS[task.priority ?? "LOW"] || PRIORITY_COLORS.LOW;
  const sc = STATUS_COLORS[task.status] || STATUS_COLORS.PENDING;
  const isDone = task.status === "COMPLETED";

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.cardRow}>
        <TouchableOpacity
          style={[styles.check, isDone && styles.checkDone]}
          onPress={() => onToggle(task.id ?? task._id ?? "", isDone ? "PENDING" : "COMPLETED")}
        >
          {isDone && <Text style={styles.checkMark}>✓</Text>}
        </TouchableOpacity>
        <View style={styles.cardInfo}>
          <Text style={[styles.title, isDone && styles.titleDone]}>{task.title}</Text>
          {!!task.description && (
            <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>
          )}
          {!!task.contactName && (
            <Text style={styles.contact}>👤 {task.contactName}</Text>
          )}
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: pc.bg }]}>
            <Text style={[styles.badgeText, { color: pc.text }]}>{task.priority || "LOW"}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{task.status}</Text>
          </View>
        </View>
      </View>
      {!!task.dueAt && (
        <Text style={styles.due}>
          Due: {new Date(task.dueAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </Text>
      )}
    </View>
  );
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMyTasks();
      setTasks(data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(id: string | number, newStatus: string) {
    const matchId = (t: Task) => (t.id ?? t._id) === id;
    setTasks((prev) => prev.map((t) => (matchId(t) ? { ...t, status: newStatus } : t)));
    try {
      await updateTaskStatus(id, newStatus);
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          matchId(t) ? { ...t, status: newStatus === "COMPLETED" ? "PENDING" : "COMPLETED" } : t
        )
      );
    }
  }

  if (loading) return <LoadingSpinner message="Loading tasks…" />;

  const pending = tasks.filter((t) => t.status !== "COMPLETED");
  const done = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {!!error && <ErrorBanner message={error} onRetry={load} />}

      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(item, index) => String(item.id ?? item._id ?? item.title ?? index)}
        renderItem={({ item }) => <TaskCard task={item} onToggle={handleToggle} />}
        ListHeaderComponent={
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>My Tasks</Text>
            <Text style={styles.summaryCount}>
              {pending.length} pending · {done.length} done
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No tasks assigned to you.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  summary: { marginBottom: 8 },
  summaryTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  summaryCount: { fontSize: 13, color: "#64748b", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  cardDone: { opacity: 0.6 },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkDone: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  checkMark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cardInfo: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  titleDone: { textDecorationLine: "line-through", color: "#94a3b8" },
  desc: { fontSize: 13, color: "#64748b", marginTop: 2 },
  contact: { fontSize: 12, color: "#64748b", marginTop: 2 },
  badges: { gap: 4, alignItems: "flex-end" },
  badge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  due: { fontSize: 12, color: "#94a3b8" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#94a3b8", fontSize: 15 },
});
