import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { useFocusEffect } from "@react-navigation/native";

interface DomainItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
}

export default function DomainCatalogScreen() {
  const [items, setItems] = useState<DomainItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/api/domain-items");
      const data = res.data ?? {};
      const list: DomainItem[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : Array.isArray(data.content) ? data.content : [];
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load catalog");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchItems();
    }, [fetchItems])
  );

  const filtered = useMemo(() =>
    items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const formatPrice = (price: number | null | undefined) =>
    price == null ? "—" : "₹" + price.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (loading) return <LoadingSpinner message="Loading catalog..." />;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); fetchItems(); }} />}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search domains..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : { paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No domains found</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{formatPrice(item.price)}</Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.category}</Text>
              </View>
            </View>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
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
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1e293b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  name: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1 },
  price: { fontSize: 15, fontWeight: "700", color: "#0f766e" },
  badgeRow: { flexDirection: "row", marginBottom: 8 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#ccfbf1" },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#0f766e" },
  description: { fontSize: 13, color: "#64748b", lineHeight: 18 },
});
