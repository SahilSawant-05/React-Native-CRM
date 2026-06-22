import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface EmailLog {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  subject: string;
  fromEmail: string;
  toEmail: string;
  status: string;
  createdAt: string;
}

interface PageResponse {
  content: EmailLog[];
  totalPages: number;
  number: number;
}

export default function MailScreen() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchEmails = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      if (pageNum === 0) setError(null);
      const res = await api.get<PageResponse>(
        `/api/email/logs/page?page=${pageNum}&size=20&folder=INBOX`
      );
      const data = res.data;
      if (replace) {
        setEmails(data.content);
      } else {
        setEmails((prev) => [...prev, ...data.content]);
      }
      setHasMore(pageNum < data.totalPages - 1);
      setPage(pageNum);
    } catch (e: any) {
      setError(e?.message || "Failed to load emails");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchEmails(0, true);
    }, [fetchEmails])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmails(0, true);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchEmails(page + 1, false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return <LoadingSpinner message="Loading emails..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchEmails(0, true); }} />}
      <FlatList
        data={emails}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        contentContainerStyle={emails.length === 0 ? styles.emptyContainer : { paddingVertical: 10 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No emails yet</Text>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#0f766e" /> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: item.direction === "INBOUND" ? "#dbeafe" : "#ccfbf1" }]}>
                <Text style={[styles.badgeText, { color: item.direction === "INBOUND" ? "#3b82f6" : "#0f766e" }]}>
                  {item.direction}
                </Text>
              </View>
              {item.status === "FAILED" && (
                <View style={[styles.badge, { backgroundColor: "#fee2e2", marginLeft: 6 }]}>
                  <Text style={[styles.badgeText, { color: "#ef4444" }]}>FAILED</Text>
                </View>
              )}
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            <Text style={styles.subject} numberOfLines={1}>{item.subject || "(No Subject)"}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.direction === "INBOUND" ? `From: ${item.fromEmail}` : `To: ${item.toEmail}`}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#94a3b8", marginTop: 40 },
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
  row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  date: { marginLeft: "auto", fontSize: 11, color: "#94a3b8" },
  subject: { fontSize: 15, fontWeight: "600", color: "#1e293b", marginBottom: 3 },
  meta: { fontSize: 13, color: "#64748b" },
});
