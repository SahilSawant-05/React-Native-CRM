import React, { useContext, useEffect, useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp } from "@react-navigation/native";
import { fetchContactById, fetchContactTimeline } from "../../api/contacts";
import { Contact } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { DrawerCtx } from "../../navigation/AdminDrawer";
import { AgentDrawerCtx } from "../../navigation/AgentDrawer";

type Props = {
  route: RouteProp<{ ContactDetail: { contact: Contact } }, "ContactDetail">;
  navigation?: any;
};

export default function ContactDetailScreen({ route }: Props) {
  const initial = route.params.contact;
  const [contact, setContact] = useState<Contact>(initial);
  // Works in both admin (DrawerCtx) and agent (AgentDrawerCtx) contexts
  const adminDrawer = useContext(DrawerCtx);
  const agentDrawer = useContext(AgentDrawerCtx);
  function navigateToTab(tab: string) {
    adminDrawer.navigateTo(tab);
    agentDrawer.navigateTo(tab);
  }
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const contactId = initial.id ?? initial._id ?? "";
        const [full, tl] = await Promise.all([
          fetchContactById(contactId),
          fetchContactTimeline(contactId),
        ]);
        setContact(full);
        setTimeline(tl ?? []);
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || "Failed to load contact");
      } finally {
        setLoading(false);
      }
    })();
  }, [initial.id]);

  if (loading) return <LoadingSpinner message="Loading contact…" />;

  const initials = (contact.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // tags may arrive as a comma-separated string or non-array — normalise
  // tags may arrive as a comma-separated string or non-array — normalise
let tags: string[] = [];
try {
  if (Array.isArray(contact.tags)) {
    tags = (contact.tags as any[]).map((t) => String(t).trim()).filter((t) => t.length > 0);
  } else if (contact.tags) {
    tags = String(contact.tags).split(",").map((t) => t.trim()).filter((t) => t.length > 0);
  }
} catch {
  tags = [];
}

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {!!error && <ErrorBanner message={error} />}

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map((tag, i) => (
                <View key={`tag-${i}-${tag}`} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {!!contact.phone && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#dcfce7" }]}
              onPress={() => Linking.openURL(`tel:${contact.phone}`)}
            >
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={[styles.actionLabel, { color: "#15803d" }]}>Call</Text>
            </TouchableOpacity>
          )}
          {/* WhatsApp → opens CRM Chat (not phone WhatsApp) */}
          {!!contact.phone && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#f0fdf4" }]}
              onPress={() => navigateToTab("Chat")}
            >
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={[styles.actionLabel, { color: "#0f766e" }]}>Chat</Text>
            </TouchableOpacity>
          )}
          {/* Email → opens CRM Mail (not phone mail app) */}
          {!!contact.email && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#eff6ff" }]}
              onPress={() => navigateToTab("Mail")}
            >
              <Text style={styles.actionIcon}>✉️</Text>
              <Text style={[styles.actionLabel, { color: "#1d4ed8" }]}>Mail</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Info</Text>
          {[
            { label: "Phone", value: contact.phone },
            { label: "Email", value: contact.email },
            { label: "Status", value: contact.status },
            { label: "Created", value: contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : null },
          ]
            .filter((f) => !!f.value)
            .map((f) => (
              <View key={f.label} style={styles.field}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldValue}>{f.value}</Text>
              </View>
            ))}
        </View>

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            {timeline.slice(0, 10).map((item, i) => (
              <View key={`tl-${i}-${item.id ?? item.createdAt ?? i}`} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineType}>{item.type || "Activity"}</Text>
                  {!!item.description && (
                    <Text style={styles.timelineDesc}>{item.description}</Text>
                  )}
                  {!!item.createdAt && (
                    <Text style={styles.timelineDate}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { gap: 12, paddingBottom: 32 },
  hero: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: "#0f766e" },
  name: { fontSize: 22, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  tag: { backgroundColor: "#eff6ff", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, color: "#1d4ed8", fontWeight: "600" },
  actions: {
    flexDirection: "row",
    marginHorizontal: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  field: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  fieldValue: { fontSize: 13, color: "#0f172a", fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  timelineItem: { flexDirection: "row", gap: 12 },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f766e",
    marginTop: 5,
  },
  timelineContent: { flex: 1, gap: 2 },
  timelineType: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  timelineDesc: { fontSize: 12, color: "#475569" },
  timelineDate: { fontSize: 11, color: "#94a3b8" },
});