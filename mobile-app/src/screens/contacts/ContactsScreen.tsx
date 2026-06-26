import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchContacts } from "../../api/contacts";
import { Contact } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

function normalizeTags(tags: any): string[] {
  if (Array.isArray(tags)) return tags.filter(Boolean);
  if (typeof tags === "string" && tags) return tags.split(",").map(t => t.trim()).filter(Boolean);
  return [];
}

function ContactRow({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  const initials = (contact.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const tags = normalizeTags(contact.tags);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.name}>{contact.name}</Text>
        {!!contact.phone && <Text style={styles.sub}>{contact.phone}</Text>}
        {!!contact.email && <Text style={styles.sub}>{contact.email}</Text>}
      </View>
      {tags.length > 0 && (
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{tags[0]}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ContactsScreen({ navigation }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  const searchRef = useRef(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent API response from overwriting list while user is actively typing
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFilter = (data: Contact[], q: string) => {
    const query = q.toLowerCase().trim();
    if (!query) return data;
    return data.filter(c =>
      (c.name || "").toLowerCase().includes(query) ||
      (c.phone || "").toLowerCase().includes(query) ||
      (c.email || "").toLowerCase().includes(query)
    );
  };

  const load = useCallback(async (p = 0, q = "", silent = false) => {
    if (p === 0 && !silent) setLoading(true);
    else if (p > 0) setLoadingMore(true);
    setError("");
    setErrorDetail("");
    try {
      const data = await fetchContacts({ page: p, size: 50, search: q });
      const items = data.content ?? [];

      setAllContacts((prev) => {
        const merged = p === 0 ? items : [...prev, ...items];
        // Only update displayed list if user is NOT actively typing
        if (!isTypingRef.current) {
          setContacts(applyFilter(merged, searchRef.current));
        }
        return merged;
      });

      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || "Failed to load contacts";
      setError(msg);
      setErrorDetail(status ? `HTTP ${status} — ${err.config?.url ?? ""}` : err.message ?? "");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0, ""); }, []);

  function handleSearch(text: string) {
    setSearch(text);
    searchRef.current = text;

    // Mark as typing — blocks API response from overwriting local filter
    isTypingRef.current = true;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 600);

    // Instant local filter — zero flicker, no focus loss
    setAllContacts((all) => {
      setContacts(applyFilter(all, text));
      return all;
    });

    // Debounced API call for deeper server-side results
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim()) {
      debounceRef.current = setTimeout(() => load(0, text, true), 800);
    } else {
      // Search cleared — restore full list immediately
      setAllContacts((all) => {
        setContacts(all);
        return all;
      });
    }
  }

  function loadMore() {
    if (!loadingMore && page + 1 < totalPages) {
      load(page + 1, search);
    }
  }

  if (loading) return <LoadingSpinner message="Loading contacts…" />;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts…"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {!!error && <ErrorBanner message={error} detail={errorDetail} onRetry={() => load(0, search)} />}

      <FlatList
        data={contacts}
        keyExtractor={(item, index) => String(item.id ?? item._id ?? item.phone ?? item.email ?? index)}
        renderItem={({ item }) => (
          <ContactRow
            contact={item}
            onPress={() => navigation.navigate("ContactDetail", { contact: item })}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No contacts found.</Text>
          </View>
        }
        contentContainerStyle={contacts.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  searchBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#0f766e" },
  rowInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 13, color: "#64748b", marginTop: 1 },
  tagBadge: { backgroundColor: "#eff6ff", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: "#1d4ed8", fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#f1f5f9" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#94a3b8", fontSize: 15 },
});