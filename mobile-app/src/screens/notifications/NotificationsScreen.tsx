import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";
import { useBadges } from "../../state/BadgeContext";
import { useAppNav, tabForTarget } from "../../navigation/useAppNav";

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
  contactId?: number | string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}

export default function NotificationsScreen() {
  const badges = useBadges();
  const { navigateTo, openChat } = useAppNav();
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
      badges.setNotificationCount(0); // clear the nav badge immediately
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
      badges.refresh(); // re-sync the nav badge from the backend
    } catch (e: any) {
      setError(e?.message || "Failed to mark notification as read");
    }
  };

  // Web parity (Notifications.jsx openNotification): mark the notification read
  // and then navigate to the page/tab it points at (targetPath / targetType /
  // type). A chat notification opens the conversation; everything else routes
  // to the matching drawer tab.
  const openNotification = (n: Notification) => {
    if (!n.readAt) markRead(n.id);
    const structured = [n.type, n.targetType, n.targetPath].filter(Boolean).join(" ");
    const text = [n.title, n.body].filter(Boolean).join(" ");
    const tab = tabForTarget(structured) || tabForTarget(text);
    if (!tab) return;
    if (tab === "Chat" && n.contactId != null && n.contactId !== "") {
      openChat({
        contactId: n.contactId as any,
        contactName: n.contactName || n.title || "Chat",
        contactPhone: n.contactPhone || undefined,
      });
      return;
    }
    navigateTo(tab);
  };

  const iconForType = (
    type: string
  ): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } => {
    const t = (type || "").toUpperCase();
    if (t.includes("CHAT") || t.includes("MESSAGE"))
      return { name: "chatbubble-outline", color: "#0f766e", bg: "#ccfbf1" };
    if (t.includes("MAIL") || t.includes("EMAIL"))
      return { name: "mail-outline", color: "#1d4ed8", bg: "#dbeafe" };
    if (t.includes("TASK") || t.includes("TODO"))
      return { name: "checkbox-outline", color: "#7c3aed", bg: "#ede9fe" };
    if (t.includes("ALERT") || t.includes("WARN") || t.includes("ERROR"))
      return { name: "alert-circle-outline", color: "#b45309", bg: "#fef3c7" };
    if (t.includes("LEAD") || t.includes("CONTACT") || t.includes("USER"))
      return { name: "person-add-outline", color: "#be185d", bg: "#fce7f3" };
    return { name: "notifications-outline", color: "#0f766e", bg: "#ccfbf1" };
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
    <SafeAreaView edges={[]} style={styles.container}>
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const icon = iconForType(item.type);
          return (
            <TouchableOpacity onPress={() => openNotification(item)} activeOpacity={0.7}>
              <View style={[styles.row, !item.readAt && styles.rowUnread]}>
                <View style={styles.dotColumn}>
                  {!item.readAt && <View style={styles.unreadDot} />}
                </View>
                <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={styles.textColumn}>
                  <View style={styles.titleLine}>
                    <Text
                      style={[styles.title, !item.readAt && styles.unreadTitle]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.message} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 15, color: "#9ca3af", marginTop: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 12,
    backgroundColor: "#ffffff",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  markAllBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13.5,
    color: "#0f766e",
    fontWeight: "600",
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.12)",
    marginLeft: 76,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingRight: 16,
    minHeight: 64,
  },
  rowUnread: { backgroundColor: "#f0fdfa" },
  dotColumn: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#0f766e",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textColumn: { flex: 1 },
  titleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    marginRight: 8,
  },
  unreadTitle: { fontWeight: "700" },
  message: { fontSize: 13.5, color: "#374151", lineHeight: 19 },
  date: { fontSize: 11.5, color: "#9ca3af" },
});