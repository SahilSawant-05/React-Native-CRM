import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchInbox, InboxItem } from "../../api/chat";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

const STATUS_TABS = ["", "OPEN", "IN_PROGRESS", "RESOLVED"];
const STATUS_LABELS: Record<string, string> = {
  "": "All",
  OPEN: "Open",
  IN_PROGRESS: "Active",
  RESOLVED: "Resolved",
};

type Props = { navigation: NativeStackNavigationProp<any> };

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function InboxRow({ item, onPress }: { item: InboxItem; onPress: () => void }) {
  const initials = (item.contactName || "?")
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {(item.unreadCount ?? 0) > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, (item.unreadCount ?? 0) > 0 && styles.nameBold]} numberOfLines={1}>
            {item.contactName}
          </Text>
          <Text style={styles.time}>{timeAgo(item.lastMessageAt)}</Text>
        </View>
        <Text style={[styles.preview, (item.unreadCount ?? 0) > 0 && styles.previewBold]} numberOfLines={1}>
          {item.lastMessage || "No messages yet"}
        </Text>
        {!!item.status && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ChatInboxScreen({ navigation }: Props) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");

  const load = useCallback(async (p = 0, s = status, q = search, silent = false) => {
    if (p === 0 && !silent) setLoading(true);
    setError("");
    setErrorDetail("");
    try {
      const data = await fetchInbox({ page: p, size: 20, status: s || undefined, search: q || undefined });
      const content = data.content ?? [];
      setItems((prev) => (p === 0 ? content : [...prev, ...content]));
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to load inbox";
      setError(msg);
      setErrorDetail(status ? `HTTP ${status} — ${err.config?.url ?? ""}` : err.message ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, search]);

  useEffect(() => { load(0, status, search); }, []);

  function switchStatus(s: string) {
    setStatus(s);
    load(0, s, search);
  }

  function handleSearch(text: string) {
    setSearch(text);
    load(0, status, text);
  }

  if (loading) return <LoadingSpinner message="Loading inbox…" />;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter tabs */}
      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STATUS_TABS.map((s) => (
            <TouchableOpacity
              key={s || "ALL"}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => switchStatus(s)}
            >
              <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                {STATUS_LABELS[s] ?? s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!error && <ErrorBanner message={error} detail={errorDetail} onRetry={() => load(0, status, search)} />}

      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.contactId ?? item.contactPhone ?? index)}
        renderItem={({ item }) => (
          <InboxRow
            item={item}
            onPress={() => navigation.navigate("ChatConversation", { inbox: item })}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(0, status, search, true); }}
            tintColor="#0f766e"
          />
        }
        onEndReached={() => { if (page + 1 < totalPages) load(page + 1); }}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptyDesc}>Your inbox is empty.</Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  searchInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: "#0f172a",
  },
  filterWrap: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  filters: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#0f766e" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 17, fontWeight: "700", color: "#0f766e" },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#0f766e",
    borderRadius: 99,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  unreadCount: { color: "#fff", fontSize: 10, fontWeight: "800" },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "500", color: "#0f172a", flex: 1 },
  nameBold: { fontWeight: "700" },
  time: { fontSize: 12, color: "#94a3b8", marginLeft: 8 },
  preview: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  previewBold: { color: "#475569", fontWeight: "500" },
  statusBadge: { marginTop: 4, alignSelf: "flex-start", backgroundColor: "#f0fdf4", borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 11, color: "#15803d", fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#f8fafc", marginLeft: 74 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  emptyDesc: { fontSize: 14, color: "#94a3b8" },
});
