import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp } from "@react-navigation/native";
import { fetchMessages, markAsRead, sendTextMessage, Message, InboxItem } from "../../api/chat";
import api from "../../api/client";
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

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
  components?: string; // JSON array of WhatsApp template components
}

function parseTemplateComponents(template: Template): any[] {
  try {
    if (!template.components) return [];
    return JSON.parse(template.components);
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
}: {
  visible: boolean;
  onClose: () => void;
  onTemplate: () => void;
  onMediaLibrary: () => void;
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 30,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  emoji: { fontSize: 24 },
  label: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  sublabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, color: "#ef4444", fontWeight: "600" },
});

// ─── Template Confirm Sheet ───────────────────────────────────────────────────
// Shown after a template is selected. If the template has a media header
// (IMAGE / VIDEO / DOCUMENT), the user must pick a media asset before sending.

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

  // Reset state whenever the sheet is opened for a new template
  useEffect(() => {
    if (template) {
      setHeaderMediaUrl("");
      setValidationError("");
    }
  }, [template]);

  function handleSend() {
    if (headerFormat && !headerMediaUrl.trim()) {
      setValidationError(
        `Please choose a ${headerFormat.toLowerCase()} from the Media Library for this template's header.`
      );
      return;
    }
    setValidationError("");
    onSend(template!, headerMediaUrl.trim() || null);
  }

  if (!template) return null;

  const displayName = template.metaTemplateName || template.name || "(unnamed)";
  const bodyText = template.body || "";

  return (
    <Modal
      visible={!!template}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        {/* Header */}
        <View style={tcStyles.header}>
          <Text style={tcStyles.title}>Send Template</Text>
          <TouchableOpacity onPress={onClose} style={tcStyles.closeBtn}>
            <Text style={tcStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={tcStyles.body}>
          {/* Template info card */}
          <View style={tcStyles.card}>
            <Text style={tcStyles.tplName}>{displayName}</Text>
            {!!template.category && (
              <Text style={tcStyles.tplCat}>{template.category}</Text>
            )}
            {!!bodyText && (
              <Text style={tcStyles.tplBody}>{bodyText}</Text>
            )}
          </View>

          {/* Header media section — only shown when template needs it */}
          {!!headerFormat && (
            <View style={tcStyles.section}>
              <Text style={tcStyles.sectionLabel}>
                Header {headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} (required)
              </Text>
              {headerMediaUrl ? (
                <View style={tcStyles.chosenMedia}>
                  {headerFormat === "IMAGE" ? (
                    <Image
                      source={{ uri: headerMediaUrl }}
                      style={tcStyles.chosenThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[tcStyles.chosenThumb, tcStyles.chosenThumbPlaceholder]}>
                      <Text style={{ fontSize: 28 }}>
                        {headerFormat === "VIDEO" ? "🎬" : "📄"}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={tcStyles.chosenUrl} numberOfLines={2}>
                      {headerMediaUrl}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setHeaderPickerOpen(true)}
                      style={tcStyles.changeBtn}
                    >
                      <Text style={tcStyles.changeBtnText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={tcStyles.chooseBtn}
                  onPress={() => setHeaderPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={tcStyles.chooseBtnEmoji}>
                    {headerFormat === "IMAGE" ? "🖼️" : headerFormat === "VIDEO" ? "🎬" : "📄"}
                  </Text>
                  <Text style={tcStyles.chooseBtnText}>
                    Choose {headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} from Media Library
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!!validationError && (
            <View style={tcStyles.errorBox}>
              <Text style={tcStyles.errorText}>{validationError}</Text>
            </View>
          )}
        </View>

        {/* Send button */}
        <View style={tcStyles.footer}>
          <TouchableOpacity style={tcStyles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Text style={tcStyles.sendBtnText}>Send Template</Text>
          </TouchableOpacity>
        </View>

        {/* Header media picker */}
        <MediaLibraryPicker
          visible={headerPickerOpen}
          onClose={() => setHeaderPickerOpen(false)}
          allowedType={headerFormat}
          title={`Choose ${headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} header`}
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
  body: { flex: 1, padding: 16, gap: 16 },
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
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#374151" },
  chooseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#0f766e",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#f0fdfa",
  },
  chooseBtnEmoji: { fontSize: 24 },
  chooseBtnText: { fontSize: 14, fontWeight: "600", color: "#0f766e", flex: 1 },
  chosenMedia: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  chosenThumb: { width: 64, height: 64, borderRadius: 8 },
  chosenThumbPlaceholder: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  chosenUrl: { fontSize: 11, color: "#64748b", flex: 1 },
  changeBtn: { marginTop: 6 },
  changeBtnText: { fontSize: 12, color: "#0f766e", fontWeight: "600" },
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
        // Newest-first order for the inverted FlatList (index 0 = bottom of screen).
        // Page 0 has the most recent messages; older pages are appended further down.
        const content = [...(data.content ?? [])];
        setMessages((prev) => (p === 0 ? content : [...prev, ...content]));
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
  root: { flex: 1, backgroundColor: "#f0f0f0" },
  messageList: { padding: 12, gap: 4, paddingBottom: 8 },
  dateSep: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  dateSepText: { fontSize: 11, color: "#fff", fontWeight: "600" },
  bubbleRow: { marginVertical: 2 },
  bubbleRowIn: { alignItems: "flex-start" },
  bubbleRowOut: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  bubbleIn: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOut: {
    backgroundColor: "#0f766e",
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 15, color: "#0f172a", lineHeight: 20 },
  bubbleTextOut: { color: "#fff" },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
  },
  bubbleTime: { fontSize: 10, color: "#94a3b8" },
  bubbleTimeOut: { color: "rgba(255,255,255,0.65)" },
  statusIcon: { fontSize: 10 },
  mediaImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
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
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 8,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  attachIcon: { fontSize: 22, color: "#64748b", lineHeight: 26 },
  input: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#cbd5e1" },
  sendIcon: { color: "#fff", fontSize: 18, marginLeft: 2 },
});