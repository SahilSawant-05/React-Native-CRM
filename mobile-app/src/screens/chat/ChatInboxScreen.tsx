import React, { useCallback, useRef, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { fetchInbox, InboxItem } from "../../api/chat";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

// "RESOLVED" removed — these map to backend status filters
const STATUS_TABS = ["", "OPEN"];
const STATUS_LABELS: Record<string, string> = {
  "": "All",
  OPEN: "Open",
  IN_PROGRESS: "Active",
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
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [allItems, setAllItems] = useState<InboxItem[]>([]);

  const searchRef = useRef(search);
  const statusRef = useRef(status);
  const unreadOnlyRef = useRef(unreadOnly);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if user is actively typing — suppress API results while typing
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've already done the initial (spinner) load
  const hasLoadedOnceRef = useRef(false);

  // Total unread message count across all loaded conversations, for the badge
  const unreadTotal = allItems.reduce((sum, i) => sum + (i.unreadCount ?? 0), 0);

  const applyFilter = (data: InboxItem[], q: string, unread: boolean) => {
    let result = data;
    if (unread) {
      result = result.filter((i) => (i.unreadCount ?? 0) > 0);
    }
    const query = q.toLowerCase().trim();
    if (query) {
      result = result.filter(i =>
        (i.contactName || "").toLowerCase().includes(query) ||
        (i.lastMessage || "").toLowerCase().includes(query)
      );
    }
    return result;
  };

  const load = useCallback(async (p = 0, s = "", q = "", silent = false) => {
    if (p === 0 && !silent) setLoading(true);
    setError("");
    setErrorDetail("");
    try {
      const data = await fetchInbox({ page: p, size: 100, status: s || undefined, search: q || undefined });
      const content = data.content ?? [];

      setAllItems((prev) => {
        const merged = p === 0 ? content : [...prev, ...content];
        // Only update displayed list if user is NOT actively typing
        if (!isTypingRef.current) {
          setItems(applyFilter(merged, searchRef.current, unreadOnlyRef.current));
        }
        return merged;
      });

      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (err: any) {
      const st = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to load inbox";
      setError(msg);
      setErrorDetail(st ? `HTTP ${st} — ${err.config?.url ?? ""}` : err.message ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh every time this screen comes into focus — not just on mount.
  // This is what picks up messages sent/received while the user was on
  // the conversation screen, so the row shows the real last message
  // instead of a stale "No messages yet".
  useFocusEffect(
    useCallback(() => {
      load(0, statusRef.current, searchRef.current, hasLoadedOnceRef.current).catch(() => {});
      hasLoadedOnceRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function switchStatus(s: string) {
    setStatus(s);
    statusRef.current = s;
    setSearch("");
    searchRef.current = "";
    isTypingRef.current = false;
    load(0, s, "");
  }

  // Client-side toggle — unread state doesn't come from the backend status
  // filter, it's derived from unreadCount on already-loaded items.
  function toggleUnread() {
    setUnreadOnly((prev) => {
      const next = !prev;
      unreadOnlyRef.current = next;
      setItems(applyFilter(allItems, searchRef.current, next));
      return next;
    });
  }

  function handleSearch(text: string) {
    setSearch(text);
    searchRef.current = text;

    // Mark as typing — prevents API response from overwriting local filter
    isTypingRef.current = true;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 600);

    // Instant local filter from the full cached list — no flicker, no stutter
    setAllItems((all) => {
      setItems(applyFilter(all, text, unreadOnlyRef.current));
      return all;
    });

    // Debounced API call for deeper server-side results
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim()) {
      debounceRef.current = setTimeout(() => {
        load(0, statusRef.current, text, true);
      }, 800); // longer delay = less interruption
    } else {
      // Cleared search — restore full list immediately (still respecting unread toggle)
      setAllItems((all) => {
        setItems(applyFilter(all, "", unreadOnlyRef.current));
        return all;
      });
    }
  }

  if (loading) return <LoadingSpinner message="Loading inbox…" />;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

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

          <TouchableOpacity
            style={[styles.chip, unreadOnly && styles.chipActive]}
            onPress={toggleUnread}
          >
            <Text style={[styles.chipText, unreadOnly && styles.chipTextActive]}>
              Unread{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.emptyTitle}>
              {unreadOnly ? "No unread conversations" : "No conversations"}
            </Text>
            <Text style={styles.emptyDesc}>
              {unreadOnly ? "You're all caught up." : "Your inbox is empty."}
            </Text>
          </View>
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        // Performance props to reduce re-render stutter
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
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