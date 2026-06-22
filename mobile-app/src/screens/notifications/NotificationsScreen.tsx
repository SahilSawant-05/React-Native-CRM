import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface Notification {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  targetId: number;
  targetPath: string;
  targetType: string;
  type: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      
      const res = await api.get<{ items: Notification[] }>(
        "/api/notifications?status=ALL&page=0&size=20"
      );
      if (!isMountedRef.current) return;
      const content = res?.data?.items;
      
      setNotifications(Array.isArray(content) ? content : []);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setError(e?.message || "Failed to load notifications");
    } finally {
      
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setLoading(true);
      setError(null);
      fetchNotifications();

      return () => {
        isMountedRef.current = false;
      };
    }, [fetchNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const retry = () => {
    setLoading(true);
    fetchNotifications();
  };

  const markAllRead = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to mark all as read");
    }
  };

  const markRead = async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (e: any) {
      setError(e?.message || "Failed to mark notification as read");
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString() +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  if (loading) return <LoadingSpinner message="Loading notifications..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={retry} />}
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No notifications</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => markRead(item.id)} activeOpacity={0.8}>
            <View style={styles.card}>
              <View style={styles.row}>
                {!item.readAt && <View style={styles.unreadDot} />}
                <View style={{ flex: 1, marginLeft: !item.readAt ? 8 : 0 }}>
                  <Text style={[styles.title, !item.readAt && styles.unreadTitle]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.message, !item.readAt && styles.unreadMessage]}>
                    {item.body}
                  </Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8", marginTop: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  markAllBtn: { padding: 8 },
  markAllText: { fontSize: 13, color: "#0f766e", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f97316",
    marginTop: 4,
  },
  title: { fontSize: 13, color: "#94a3b8", fontWeight: "500", marginBottom: 2 },
  unreadTitle: { color: "#0f766e", fontWeight: "700" },
  message: { fontSize: 14, color: "#475569", lineHeight: 20 },
  unreadMessage: { color: "#1e293b", fontWeight: "600" },
  date: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
});