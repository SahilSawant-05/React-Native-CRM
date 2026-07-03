import React, { useCallback, useContext, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { fetchInbox, InboxItem } from "../../api/chat";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { DrawerCtx } from "../../navigation/AdminDrawer";
import { AgentDrawerCtx } from "../../navigation/AgentDrawer";

// "RESOLVED" removed — these map to backend status filters.
// "UNREAD" is a client-side-only pseudo-tab (see selectTab below) — it
// doesn't hit the backend status filter, it just flips unreadOnly.
const STATUS_TABS = ["", "OPEN", "UNREAD"];
const STATUS_LABELS: Record<string, string> = {
  "": "All",
  OPEN: "Open",
  IN_PROGRESS: "Active",
  UNREAD: "Unread",
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
  const unread = (item.unreadCount ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {item.contactName}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>
            {timeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread && styles.previewBold]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {(item.unreadCount ?? 0) > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatInboxScreen({ navigation }: Props) {
  const adminDrawer = useContext(DrawerCtx);
  const agentDrawer = useContext(AgentDrawerCtx);

  const [items, setItems] = useState<InboxItem[]>([]);
  // "" | "OPEN" | "UNREAD" — which tab is active. Mutually exclusive now,
  // rather than a separate toggle layered on top of the status tabs.
  const [activeTab, setActiveTab] = useState("");
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
  // Backend status filter actually sent to fetchInbox — "" or "OPEN".
  // UNREAD never gets sent to the backend, it's filtered client-side.
  const statusRef = useRef("");
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
      // If a contact was requested via openChat(), navigate straight to their conversation
      const pending = adminDrawer.pendingChatRef.current ?? agentDrawer.pendingChatRef.current;
      if (pending) {
        adminDrawer.pendingChatRef.current = null;
        agentDrawer.pendingChatRef.current = null;
        const inbox: InboxItem = {
          contactId: pending.contactId,
          contactName: pending.contactName,
          contactPhone: pending.contactPhone,
          lastMessage: "",
          unreadCount: 0,
        };
        navigation.navigate("ChatConversation", { inbox });
      }

      load(0, statusRef.current, searchRef.current, hasLoadedOnceRef.current).catch(() => {});
      hasLoadedOnceRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Single entry point for the tab row now that Unread lives inside it.
  // "" / "OPEN" hit the backend status filter and turn unreadOnly off.
  // "UNREAD" doesn't touch the backend filter — it refetches with no
  // status (so nothing is excluded server-side) and turns unreadOnly on
  // so applyFilter narrows it down client-side.
  function selectTab(tab: string) {
    setActiveTab(tab);
    setSearch("");
    searchRef.current = "";
    isTypingRef.current = false;

    if (tab === "UNREAD") {
      setUnreadOnly(true);
      unreadOnlyRef.current = true;
      statusRef.current = "";
      load(0, "", "");
    } else {
      setUnreadOnly(false);
      unreadOnlyRef.current = false;
      statusRef.current = tab;
      load(0, tab, "");
    }
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
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab || "ALL"}
              style={[styles.chip, activeTab === tab && styles.chipActive]}
              onPress={() => selectTab(tab)}
            >
              <Text style={[styles.chipText, activeTab === tab && styles.chipTextActive]}>
                {STATUS_LABELS[tab] ?? tab}
                {tab === "UNREAD" && unreadTotal > 0 ? ` (${unreadTotal})` : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!error && <ErrorBanner message={error} detail={errorDetail} onRetry={() => load(0, statusRef.current, search)} />}

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
            onRefresh={() => { setRefreshing(true); load(0, statusRef.current, search, true); }}
            tintColor="#0f766e"
          />
        }
        onEndReached={() => { if (page + 1 < totalPages) load(page + 1); }}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={52} color="#d1d5db" />
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
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  searchInput: {
    backgroundColor: "#f0f2f5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 9 : 7,
    fontSize: 15,
    letterSpacing: Platform.OS === "ios" ? -0.24 : 0,
    color: "#111b21",
  },
  filterWrap: {},
  filters: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  // WhatsApp filter chips: soft grey default, soft green when active
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#f0f2f5",
  },
  chipActive: { backgroundColor: "#d9fdd3" },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#54656f",
    letterSpacing: Platform.OS === "ios" ? -0.08 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  chipTextActive: { color: "#15603e", fontWeight: "600" },

  // Row — WhatsApp anatomy: avatar · (name+time / preview+badge)
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    gap: 13,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#d9fdd3",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f766e",
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#111b21",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
    marginRight: 8,
  },
  time: { fontSize: 12, color: "#667781" },
  timeUnread: { color: "#1daa61", fontWeight: "600" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: {
    flex: 1,
    fontSize: 13.5,
    color: "#667781",
    letterSpacing: Platform.OS === "ios" ? -0.15 : 0,
    lineHeight: 18,
  },
  previewBold: { color: "#3b4a54", fontWeight: "500" },
  // WhatsApp green unread counter, right side of the preview line
  unreadBadge: {
    backgroundColor: "#25d366",
    borderRadius: 99,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadCount: { color: "#fff", fontSize: 11, fontWeight: "700" },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.1)",
    marginLeft: 77,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111b21",
    letterSpacing: Platform.OS === "ios" ? 0.3 : 0,
  },
  emptyDesc: { fontSize: 14, color: "#8696a0" },
});
