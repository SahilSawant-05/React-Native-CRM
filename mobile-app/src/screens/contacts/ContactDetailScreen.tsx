import React, { useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const mediumFont = Platform.OS === "android" ? "sans-serif-medium" : undefined;
import { RouteProp } from "@react-navigation/native";
import { fetchContactById, fetchContactTimeline } from "../../api/contacts";
import { Contact } from "../../types";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { DrawerCtx } from "../../navigation/AdminDrawer";
import { AgentDrawerCtx } from "../../navigation/AgentDrawer";
import { smartCall } from "../../api/telephony";

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
  function openContactChat() {
    const pending = { contactId: contact.id ?? contact._id ?? "", contactName: contact.name, contactPhone: contact.phone };
    adminDrawer.openChat(pending);
    agentDrawer.openChat(pending);
  }
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [callPlacing, setCallPlacing] = useState(false);

  // Toggle-aware calling: CRM click-to-call when telephony is active +
  // click-to-call enabled, otherwise the phone's native dialer.
  async function handleCall() {
    if (callPlacing || !contact.phone) return;
    setCallPlacing(true);
    try {
      const result = await smartCall({
        contactId: contact.id ?? contact._id ?? null,
        phone: contact.phone,
      });
      if (result.mode === "CRM") {
        Alert.alert(
          "CRM call started",
          `Call logged as ${result.status}. Your phone will ring first, then the customer is connected.`
        );
      } else if (result.failureReason) {
        // CRM was on but couldn't start — we already fell back to the dialer.
        Alert.alert("Called via phone", `CRM call failed (${result.failureReason}), dialed normally instead.`);
      }
    } finally {
      setCallPlacing(false);
    }
  }

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
    <SafeAreaView style={styles.root} edges={[]}>
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
              style={styles.actionBtn}
              onPress={handleCall}
              disabled={callPlacing}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#dcfce7" }]}>
                {callPlacing ? (
                  <ActivityIndicator size="small" color="#15803d" />
                ) : (
                  <Ionicons name="call" size={22} color="#15803d" />
                )}
              </View>
              <Text style={[styles.actionLabel, { color: "#15803d" }]}>Call</Text>
            </TouchableOpacity>
          )}
          {/* WhatsApp → opens CRM Chat for this specific contact */}
          {!!contact.phone && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={openContactChat}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#ccfbf1" }]}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#0f766e" />
              </View>
              <Text style={[styles.actionLabel, { color: "#0f766e" }]}>Chat</Text>
            </TouchableOpacity>
          )}
          {/* Email → opens CRM Mail (not phone mail app) */}
          {!!contact.email && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigateToTab("Mail")}
            >
              <View style={[styles.actionCircle, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="mail" size={22} color="#1d4ed8" />
              </View>
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

const iosTight = Platform.OS === "ios" ? -0.32 : undefined;
const iosTightSm = Platform.OS === "ios" ? -0.15 : undefined;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { gap: 16, paddingBottom: 32 },
  hero: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 10,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#ccfbf1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#0f766e",
    fontFamily: mediumFont,
  },
  name: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    fontFamily: mediumFont,
    letterSpacing: iosTight,
  },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  tag: {
    backgroundColor: "rgba(15,118,110,0.08)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12, color: "#0f766e", fontWeight: "600", fontFamily: mediumFont },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: 16,
    gap: 28,
  },
  actionBtn: {
    alignItems: "center",
    gap: 6,
    minWidth: 56,
    minHeight: 44,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    fontFamily: mediumFont,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
    fontFamily: mediumFont,
  },
  field: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  fieldLabel: { fontSize: 12, color: "#6b7280", fontWeight: "500", letterSpacing: iosTightSm },
  fieldValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    fontFamily: mediumFont,
    maxWidth: "60%",
    textAlign: "right",
    letterSpacing: iosTightSm,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f766e",
    marginTop: 5,
  },
  timelineContent: { flex: 1, gap: 2 },
  timelineType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    fontFamily: mediumFont,
    letterSpacing: iosTightSm,
  },
  timelineDesc: { fontSize: 12.5, color: "#374151" },
  timelineDate: { fontSize: 11.5, color: "#9ca3af" },
});