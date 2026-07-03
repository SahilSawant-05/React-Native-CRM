import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { RouteProp } from "@react-navigation/native";
import { fetchMessages, markAsRead, sendTextMessage, Message, InboxItem } from "../../api/chat";
import api from "../../api/client";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import AiAssistPanel from "../../components/ai/AiAssistPanel";

type Props = {
  route: RouteProp<{ ChatConversation: { inbox: InboxItem } }, "ChatConversation">;
  navigation?: any;
};

interface Template {
  id: string | number;
  name?: string;
  metaTemplateName?: string;
  category?: string;
  body?: string;
  status?: string;
  componentsJson?: string; // JSON array of WhatsApp template components (matches web field name)
}

function parseTemplateComponents(template: Template): any[] {
  try {
    const parsed = JSON.parse(template?.componentsJson || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Returns "IMAGE" | "VIDEO" | "DOCUMENT" | "" depending on the template's HEADER component
function templateHeaderMediaFormat(template: Template): string {
  const header = parseTemplateComponents(template).find(
    (c: any) => String(c?.type || "").toUpperCase() === "HEADER"
  );
  const format = String(header?.format || "").toUpperCase();
  return ["IMAGE", "VIDEO", "DOCUMENT"].includes(format) ? format : "";
}

// Media asset returned by the /api/media-assets endpoint (same shape the web app uses)
interface MediaAsset {
  id: string | number;
  publicUrl: string;
  mediaType: string;        // "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO"
  originalFileName?: string;
  name?: string;
  createdAt?: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }).format(new Date(dateStr));
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(dateStr));
}

// Returns a reliable epoch ms for a message regardless of which timestamp
// field the API populated (createdAt vs timestamp), used for sorting.
function messageTime(m?: Message): number {
  if (!m) return 0;
  const raw = m.createdAt || m.timestamp;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function StatusTick({ status }: { status?: string }) {
  const s = (status ?? "").toUpperCase();
  if (s === "READ") return <Text style={[styles.statusIcon, { color: "#38bdf8" }]}> ✓✓</Text>;
  if (s === "DELIVERED") return <Text style={[styles.statusIcon, { color: "rgba(255,255,255,0.8)" }]}> ✓✓</Text>;
  return <Text style={[styles.statusIcon, { color: "rgba(255,255,255,0.55)" }]}> ✓</Text>;
}

function MediaBubble({ message, isOut }: { message: Message; isOut: boolean }) {
  const mt = (message.mediaType ?? "").toUpperCase();
  const url = message.mediaUrl;
  if (!url) return null;

  if (mt === "IMAGE" || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) {
    return (
      <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
    );
  }
  const emoji = mt === "VIDEO" ? "🎬" : mt === "AUDIO" ? "🎵" : "📎";
  return (
    <View style={styles.mediaFile}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        style={[styles.mediaFileName, isOut && { color: "rgba(255,255,255,0.85)" }]}
        numberOfLines={1}
      >
        {message.mediaFileName || "Attachment"}
      </Text>
    </View>
  );
}

function MessageBubble({ message, prevMessage }: { message: Message; prevMessage?: Message }) {
  const isOut = message.direction === "OUTBOUND";
  const text = message.textBody || message.body || message.text || "";
  const time = message.createdAt || message.timestamp;

  // In an inverted list prevMessage is the older message just above this one.
  // Show the date separator BELOW this bubble (rendered above in inverted list)
  // when it belongs to a different day than the older neighbour.
  const prevDate = prevMessage ? formatDate(prevMessage.createdAt || prevMessage.timestamp) : null;
  const thisDate = formatDate(time);
  const showDateSep = prevDate !== null && prevDate !== thisDate;

  return (
    <>
      {showDateSep && (
        <View style={styles.dateSep}>
          <Text style={styles.dateSepText}>{thisDate}</Text>
        </View>
      )}
      <View style={[styles.bubbleRow, isOut ? styles.bubbleRowOut : styles.bubbleRowIn]}>
        <View style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn]}>
          {message.mediaUrl && <MediaBubble message={message} isOut={isOut} />}
          {!!text && (
            <Text style={[styles.bubbleText, isOut && styles.bubbleTextOut]}>{text}</Text>
          )}
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, isOut && styles.bubbleTimeOut]}>
              {formatTime(time)}
            </Text>
            {isOut && <StatusTick status={message.status} />}
          </View>
        </View>
      </View>
    </>
  );
}

// ─── Template Picker Modal ────────────────────────────────────────────────────

function TemplatePicker({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (t: Template) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .get("/api/templates")
      .then((r) => {
        const d = r.data ?? {};
        const items: Template[] = Array.isArray(d)
          ? d
          : Array.isArray(d.items)
          ? d.items
          : Array.isArray(d.content)
          ? d.content
          : [];
        setTemplates(
          items.filter((t) => (t as any).status === "APPROVED" || !(t as any).status)
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={tpStyles.header}>
          <Text style={tpStyles.title}>Send Template</Text>
          <TouchableOpacity onPress={onClose} style={tpStyles.closeBtn}>
            <Text style={tpStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0f766e" />
        ) : (
          <FlatList
            data={templates}
            keyExtractor={(t) => String(t.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>
                No approved templates
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={tpStyles.row}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={tpStyles.name}>
                  {item.metaTemplateName || item.name || "(unnamed)"}
                </Text>
                {!!item.category && <Text style={tpStyles.cat}>{item.category}</Text>}
                {!!item.body && (
                  <Text style={tpStyles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const tpStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  name: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cat: { fontSize: 11, color: "#0f766e", marginTop: 3, fontWeight: "600" },
  body: { fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 17 },
});

// ─── Media Library Picker Modal ───────────────────────────────────────────────
// Mirrors web's MediaLibraryDialog: fetches already-hosted assets from the CRM
// and returns a publicUrl — no file upload needed.

function MediaLibraryPicker({
  visible,
  onClose,
  onSelect,
  allowedType,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  allowedType?: string; // if set, lock filter to this type
  title?: string;
}) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO">("ALL");

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError("");
    // If locked to a specific type, reset filter to match
    if (allowedType) {
      setFilter(allowedType as any);
    }
    api
      .get("/api/media-assets")
      .then((r) => {
        const d = r.data ?? {};
        const items: MediaAsset[] = Array.isArray(d)
          ? d
          : Array.isArray(d.items)
          ? d.items
          : Array.isArray(d.content)
          ? d.content
          : [];
        setAssets(items);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || "Failed to load media");
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const activeFilter = allowedType ? (allowedType as any) : filter;
  const filtered =
    activeFilter === "ALL" ? assets : assets.filter((a) => a.mediaType === activeFilter);

  const filterTypes: Array<"ALL" | "IMAGE" | "VIDEO" | "DOCUMENT" | "AUDIO"> = [
    "ALL", "IMAGE", "VIDEO", "DOCUMENT", "AUDIO",
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Header */}
        <View style={mlStyles.header}>
          <Text style={mlStyles.title}>{title ?? "Media Library"}</Text>
          <TouchableOpacity onPress={onClose} style={mlStyles.closeBtn}>
            <Text style={mlStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={mlStyles.hint}>
          {allowedType
            ? `Choose a ${allowedType.toLowerCase()} for the template header.`
            : "Tap any asset to send it. These are already-hosted public URLs — no upload needed."}
        </Text>

        {/* Type filter tabs — hidden when locked to a specific type */}
        {!allowedType && (
          <View style={mlStyles.filterRow}>
            {filterTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFilter(type)}
                style={[mlStyles.filterBtn, filter === type && mlStyles.filterBtnActive]}
              >
                <Text style={[mlStyles.filterText, filter === type && mlStyles.filterTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#0f766e" />
        ) : error ? (
          <Text style={mlStyles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={mlStyles.emptyText}>
            No {filter === "ALL" ? "" : filter.toLowerCase() + " "}assets found.{"\n"}
            Upload files from the web CRM → Media Library first.
          </Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 12, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={mlStyles.assetRow}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                {item.mediaType === "IMAGE" && item.publicUrl ? (
                  <Image
                    source={{ uri: item.publicUrl }}
                    style={mlStyles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[mlStyles.thumb, mlStyles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 28 }}>
                      {item.mediaType === "VIDEO"
                        ? "🎬"
                        : item.mediaType === "AUDIO"
                        ? "🎵"
                        : "📄"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={mlStyles.assetName} numberOfLines={1}>
                    {item.originalFileName || item.name || "Untitled"}
                  </Text>
                  <Text style={mlStyles.assetType}>{item.mediaType}</Text>
                  {!!item.createdAt && (
                    <Text style={mlStyles.assetDate}>
                      {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                        new Date(item.createdAt)
                      )}
                    </Text>
                  )}
                </View>
                <Text style={mlStyles.selectArrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const mlStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  hint: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  filterBtnActive: { backgroundColor: "#0f766e" },
  filterText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  filterTextActive: { color: "#fff" },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  assetName: { fontSize: 13, fontWeight: "600", color: "#0f172a" },
  assetType: { fontSize: 11, color: "#0f766e", marginTop: 2, fontWeight: "600" },
  assetDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  selectArrow: { fontSize: 22, color: "#94a3b8" },
  errorText: { color: "#ef4444", textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
});

// ─── Attachment action sheet ──────────────────────────────────────────────────

function AttachMenu({
  visible,
  onClose,
  onTemplate,
  onMediaLibrary,
  onUploadDevice,
}: {
  visible: boolean;
  onClose: () => void;
  onTemplate: () => void;
  onMediaLibrary: () => void;
  onUploadDevice: () => void;
}) {
  if (!visible) return null;
  return (
    <TouchableOpacity style={amStyles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={amStyles.sheet}>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onTemplate();
          }}
        >
          <Text style={amStyles.emoji}>📝</Text>
          <View>
            <Text style={amStyles.label}>Send Template</Text>
            <Text style={amStyles.sublabel}>WhatsApp approved templates</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onMediaLibrary();
          }}
        >
          <Text style={amStyles.emoji}>🖼️</Text>
          <View>
            <Text style={amStyles.label}>Send Media</Text>
            <Text style={amStyles.sublabel}>Images, videos, documents from CRM library</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={amStyles.item}
          onPress={() => {
            onClose();
            onUploadDevice();
          }}
        >
          <Text style={amStyles.emoji}>📂</Text>
          <View>
            <Text style={amStyles.label}>Upload from Device</Text>
            <Text style={amStyles.sublabel}>Pick a file from your phone and send</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={amStyles.cancel} onPress={onClose}>
          <Text style={amStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const amStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
    zIndex: 99,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.12)",
  },
  emoji: { fontSize: 24 },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  sublabel: { fontSize: 12.5, color: "#9ca3af", marginTop: 2 },
  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 13, backgroundColor: "rgba(118,118,128,0.08)", borderRadius: 14 },
  cancelText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "600",
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
});

// ─── Template Confirm Sheet ───────────────────────────────────────────────────
// Shown after a template is selected. Matches the web UX:
//   • Template name + body preview
//   • If template has IMAGE/VIDEO/DOCUMENT header:
//       - "Header image URL" label  +  "Choose header media" button (side by side)
//       - Text input pre-filled from media library pick, or typed manually
//   • Send button

function TemplateConfirmSheet({
  template,
  onClose,
  onSend,
}: {
  template: Template | null;
  onClose: () => void;
  onSend: (t: Template, headerMediaUrl: string | null) => void;
}) {
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerPickerOpen, setHeaderPickerOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  const headerFormat = template ? templateHeaderMediaFormat(template) : "";

  useEffect(() => {
    if (template) {
      setHeaderMediaUrl("");
      setValidationError("");
    }
  }, [template]);

  function handleSend() {
    if (headerFormat && !headerMediaUrl.trim()) {
      setValidationError(
        `Please choose a ${headerFormat.toLowerCase()} for this template's header.`
      );
      return;
    }
    setValidationError("");
    onSend(template!, headerMediaUrl.trim() || null);
  }

  if (!template) return null;

  const displayName = template.metaTemplateName || template.name || "(unnamed)";
  const bodyText = template.body || "";
  const headerLabel = headerFormat
    ? `Header ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} URL`
    : "";
  const headerPlaceholder =
    headerFormat === "IMAGE"
      ? "https://example.com/header.jpg"
      : headerFormat === "VIDEO"
      ? "https://example.com/header.mp4"
      : "https://example.com/header.pdf";

  return (
    <Modal
      visible={!!template}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Sheet header */}
        <View style={tcStyles.header}>
          <Text style={tcStyles.title}>Send Template</Text>
          <TouchableOpacity onPress={onClose} style={tcStyles.closeBtn}>
            <Text style={tcStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={tcStyles.body} keyboardShouldPersistTaps="handled">
          {/* Template preview card */}
          <View style={tcStyles.card}>
            <Text style={tcStyles.tplName}>{displayName}</Text>
            {!!template.category && (
              <Text style={tcStyles.tplCat}>{template.category}</Text>
            )}
            {!!bodyText && (
              <Text style={tcStyles.tplBody}>{bodyText}</Text>
            )}
          </View>

          {/* Header media section — only shown when template HEADER needs IMAGE/VIDEO/DOCUMENT */}
          {!!headerFormat && (
            <View style={tcStyles.section}>
              {/* Label row: "Header image URL"  |  [Choose header media] */}
              <View style={tcStyles.headerLabelRow}>
                <Text style={tcStyles.sectionLabel}>{headerLabel}</Text>
                <TouchableOpacity
                  style={tcStyles.chooseBtn}
                  onPress={() => setHeaderPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={tcStyles.chooseBtnIcon}>
                    {headerFormat === "IMAGE" ? "🖼️" : headerFormat === "VIDEO" ? "🎬" : "📄"}
                  </Text>
                  <Text style={tcStyles.chooseBtnText}>Choose header media</Text>
                </TouchableOpacity>
              </View>

              {/* URL text input (pre-filled from library pick, or typed manually) */}
              <TextInput
                style={tcStyles.urlInput}
                placeholder={headerPlaceholder}
                placeholderTextColor="#94a3b8"
                value={headerMediaUrl}
                onChangeText={(v) => { setHeaderMediaUrl(v); setValidationError(""); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              {/* Thumbnail preview once a URL is set */}
              {!!headerMediaUrl.trim() && headerFormat === "IMAGE" && (
                <Image
                  source={{ uri: headerMediaUrl.trim() }}
                  style={tcStyles.previewThumb}
                  resizeMode="cover"
                />
              )}

              <Text style={tcStyles.hint}>
                This template requires a public HTTPS {headerFormat.toLowerCase()} header for every send.
              </Text>
            </View>
          )}

          {!!validationError && (
            <View style={tcStyles.errorBox}>
              <Text style={tcStyles.errorText}>{validationError}</Text>
            </View>
          )}
        </ScrollView>

        {/* Send button */}
        <View style={tcStyles.footer}>
          <TouchableOpacity style={tcStyles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Text style={tcStyles.sendBtnText}>Send Template</Text>
          </TouchableOpacity>
        </View>

        {/* Header media library picker — locked to the required type */}
        <MediaLibraryPicker
          visible={headerPickerOpen}
          onClose={() => setHeaderPickerOpen(false)}
          allowedType={headerFormat}
          title={`Choose ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} header media`}
          onSelect={(asset) => {
            setHeaderMediaUrl(asset.publicUrl || "");
            setHeaderPickerOpen(false);
            setValidationError("");
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const tcStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  body: { padding: 16, gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  tplName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  tplCat: { fontSize: 12, color: "#0f766e", fontWeight: "600" },
  tplBody: { fontSize: 13, color: "#475569", lineHeight: 18, marginTop: 4 },
  section: { gap: 10 },
  headerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: "#374151", flex: 1 },
  chooseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  chooseBtnIcon: { fontSize: 14 },
  chooseBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  urlInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  previewThumb: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  hint: { fontSize: 11, color: "#64748b" },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 13 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  sendBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatConversationScreen({ route }: Props) {
  const { inbox } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [attachOpen, setAttachOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(
    async (p = 0) => {
      if (p === 0) setLoading(true);
      else setLoadingMore(true);
      setError("");
      try {
        const data = await fetchMessages(inbox.contactId, p);
        // The backend's ordering isn't guaranteed to already be
        // newest-first — some endpoints return ascending (oldest first)
        // per page. Since this is an INVERTED FlatList, index 0 must
        // always be the newest message or the whole thread renders out
        // of order and new messages won't land at the bottom like
        // WhatsApp. Sort explicitly rather than trust the API's order.
        const content = [...(data.content ?? [])].sort(
          (a, b) => messageTime(b) - messageTime(a)
        );
        setMessages((prev) => {
          const merged = p === 0 ? content : [...prev, ...content];
          // Re-sort the merged result too, in case an older page's
          // messages interleave in time with what's already loaded.
          return merged.sort((a, b) => messageTime(b) - messageTime(a));
        });
        setTotalPages(data.totalPages ?? 1);
        setPage(p);
      } catch (err: any) {
        setError(
          err?.response?.data?.message || err.message || "Failed to load messages"
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [inbox.contactId]
  );

  useEffect(() => {
    load(0);
    markAsRead(inbox.contactId).catch(() => {});
  }, []);

  // Inverted list: prepending puts the new message at the bottom instantly.
  const appendOptimistic = (msg: Message) => {
    setMessages((prev) => [msg, ...prev]);
  };

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      textBody: trimmed,
      direction: "OUTBOUND",
      createdAt: new Date().toISOString(),
      status: "SENT",
    };
    appendOptimistic(optimistic);
    setText("");
    try {
      await sendTextMessage(inbox.contactId, trimmed);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(trimmed);
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendTemplate(template: Template, headerMediaUrl: string | null) {
    setSelectedTemplate(null);
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      textBody: `[Template: ${template.metaTemplateName || template.name}]`,
      direction: "OUTBOUND",
      createdAt: new Date().toISOString(),
      status: "SENT",
    };
    appendOptimistic(optimistic);
    try {
      await api.post("/api/messages/send-whatsapp/template", {
        contactId: inbox.contactId,
        templateId: template.id,
        bodyParameters: [],
        headerMediaUrl: headerMediaUrl || null,
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(
        err?.response?.data?.message || err?.message || "Failed to send template"
      );
    } finally {
      setSending(false);
    }
  }

  // ── Send media from CRM library (no upload — uses already-hosted publicUrl) ─
  async function handleSendMediaAsset(asset: MediaAsset) {
    setMediaLibraryOpen(false);
    if (!asset.publicUrl) {
      setError("Selected asset has no public URL. Re-upload it from the web CRM.");
      return;
    }

    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      mediaUrl: asset.publicUrl,
      mediaType: asset.mediaType,
      mediaFileName: asset.originalFileName || asset.name || "Attachment",
      direction: "OUTBOUND",
      createdAt: new Date().toISOString(),
      status: "SENT",
    };
    appendOptimistic(optimistic);

    try {
      // Identical to what the web app does in sendMediaMessage()
      await api.post("/api/messages/send-whatsapp/media", {
        contactId: inbox.contactId,
        mediaType: asset.mediaType,
        mediaUrl: asset.publicUrl,
        fileName: asset.originalFileName || asset.name || null,
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(
        err?.response?.data?.message || err?.message || "Failed to send media"
      );
    } finally {
      setSending(false);
    }
  }

  async function handleUploadFromDevice() {
    let result;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    } catch {
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      } as any);
      const uploadRes = await api.post("/api/media-assets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const publicUrl: string = uploadRes.data?.publicUrl || uploadRes.data?.url || "";
      if (!publicUrl) throw new Error("Upload succeeded but no public URL returned.");

      const mimeType = file.mimeType || "";
      const mediaType = mimeType.startsWith("image/") ? "IMAGE"
        : mimeType.startsWith("video/") ? "VIDEO"
        : mimeType.startsWith("audio/") ? "AUDIO"
        : "DOCUMENT";

      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        mediaUrl: publicUrl,
        mediaType,
        mediaFileName: file.name,
        direction: "OUTBOUND",
        createdAt: new Date().toISOString(),
        status: "SENT",
      };
      appendOptimistic(optimistic);

      await api.post("/api/messages/send-whatsapp/media", {
        contactId: inbox.contactId,
        mediaType,
        mediaUrl: publicUrl,
        fileName: file.name || null,
      });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.response?.data?.message || err?.message || "Failed to upload file.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading conversation…" />;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {!!error && <ErrorBanner message={error} />}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) =>
            String(
              item.id ?? item.messageId ?? item.createdAt ?? item.timestamp ?? index
            )
          }
          // inverted=true flips the list so index-0 sits at the bottom, exactly
          // like WhatsApp. Newest messages (prepended) appear at the bottom.
          inverted
          renderItem={({ item, index }) => (
            // In an inverted list index 0 is the newest message (bottom).
            // The "previous" message in time is at index+1 (above it).
            <MessageBubble message={item} prevMessage={messages[index + 1]} />
          )}
          // onEndReached fires when the user scrolls UP to the top (inverted).
          onEndReached={() => {
            if (!loadingMore && page + 1 < totalPages) load(page + 1);
          }}
          onEndReachedThreshold={0.2}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
            </View>
          }
          // Show a loading indicator at the top (rendered at bottom in inverted)
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#0f766e" style={{ marginVertical: 8 }} />
            ) : null
          }
        />

        {/* AI panel (collapsible) */}
        {aiPanelOpen && (
          <View style={styles.aiPanelWrap}>
            <AiAssistPanel
              contactId={inbox.contactId}
              title="AI Chat Assistant"
              contextPrompt={
                `Contact: ${inbox.contactName || ""}. ` +
                `Last messages:\n` +
                messages
                  .slice(0, 12)
                  .reverse()
                  .map((m) => `${m.direction === "OUTBOUND" ? "Agent" : "Contact"}: ${m.textBody || m.mediaType || ""}`)
                  .join("\n") +
                `\n\nSummarise this WhatsApp conversation and recommend the next best CRM action.`
              }
              replyPrompt={
                `Contact: ${inbox.contactName || ""}.\n` +
                `Last messages:\n` +
                messages
                  .slice(0, 12)
                  .reverse()
                  .map((m) => `${m.direction === "OUTBOUND" ? "Agent" : "Contact"}: ${m.textBody || m.mediaType || ""}`)
                  .join("\n") +
                `\n\nWrite a short, warm WhatsApp reply to continue this conversation. Keep it human and helpful.`
              }
              onApply={(t) => setText((prev) => prev ? prev + "\n" + t : t)}
              applyLabel="Use in message"
            />
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setAttachOpen(true)}
          >
            <Text style={styles.attachIcon}>＋</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4096}
          />
          <TouchableOpacity
            style={[styles.aiToggleBtn, aiPanelOpen && styles.aiToggleBtnActive]}
            onPress={() => setAiPanelOpen((v) => !v)}
          >
            <Text style={styles.aiToggleIcon}>✨</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!text.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AttachMenu
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onTemplate={() => setTemplatePickerOpen(true)}
        onMediaLibrary={() => setMediaLibraryOpen(true)}
        onUploadDevice={handleUploadFromDevice}
      />

      <TemplatePicker
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(t) => {
          setTemplatePickerOpen(false);
          setSelectedTemplate(t);
        }}
      />

      <TemplateConfirmSheet
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onSend={handleSendTemplate}
      />

      <MediaLibraryPicker
        visible={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={handleSendMediaAsset}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#eef2f5" },
  messageList: { paddingHorizontal: 14, paddingVertical: 10, gap: 3, paddingBottom: 8 },
  dateSep: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateSepText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    letterSpacing: 0.2,
    fontFamily: Platform.OS === "android" ? "sans-serif-medium" : undefined,
  },
  bubbleRow: { marginVertical: 1.5 },
  bubbleRowIn: { alignItems: "flex-start" },
  bubbleRowOut: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 2,
  },
  bubbleIn: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 5,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
    elevation: 1,
  },
  bubbleOut: {
    backgroundColor: "#0f766e",
    borderBottomRightRadius: 5,
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 22,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
  },
  bubbleTextOut: { color: "#fff" },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 1,
  },
  bubbleTime: { fontSize: 11, color: "#9ca3af", letterSpacing: 0.1 },
  bubbleTimeOut: { color: "rgba(255,255,255,0.7)" },
  statusIcon: { fontSize: 11 },
  mediaImage: { width: 230, height: 172, borderRadius: 12, marginBottom: 4 },
  mediaFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  mediaFileName: { fontSize: 13, color: "#1e293b", flex: 1 },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyChatText: { color: "#94a3b8", fontSize: 14 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 10,
    backgroundColor: "#f8f9fb",
    gap: 6,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  attachIcon: { fontSize: 26, color: "#0f766e", lineHeight: 30, fontWeight: "300" },
  input: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 11 : 9,
    paddingBottom: Platform.OS === "ios" ? 11 : 9,
    fontSize: 16,
    letterSpacing: Platform.OS === "ios" ? -0.32 : 0,
    color: "#111827",
    maxHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.15)",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: "#d1d5db",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: { color: "#fff", fontSize: 17, marginLeft: 2 },
  aiPanelWrap: { paddingHorizontal: 10, paddingBottom: 6, backgroundColor: "#f8f9fb" },
  aiToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  aiToggleBtnActive: {
    backgroundColor: "#ccfbf1",
  },
  aiToggleIcon: { fontSize: 19 },
});