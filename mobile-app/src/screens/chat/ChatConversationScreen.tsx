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
import * as DocumentPicker from "expo-document-picker";
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
      <Image
        source={{ uri: url }}
        style={styles.mediaImage}
        resizeMode="cover"
      />
    );
  }
  const emoji = mt === "VIDEO" ? "🎬" : mt === "AUDIO" ? "🎵" : "📎";
  return (
    <View style={styles.mediaFile}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={[styles.mediaFileName, isOut && { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
        {message.mediaFileName || "Attachment"}
      </Text>
    </View>
  );
}

function MessageBubble({ message, prevMessage }: { message: Message; prevMessage?: Message }) {
  const isOut = message.direction === "OUTBOUND";
  const text = message.textBody || message.body || message.text || "";
  const time = message.createdAt || message.timestamp;

  const prevDate = prevMessage ? formatDate(prevMessage.createdAt || prevMessage.timestamp) : null;
  const thisDate = formatDate(time);
  const showDateSep = prevDate !== thisDate;

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
  visible: boolean; onClose: () => void;
  onSelect: (t: Template) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get("/api/templates")
      .then(r => {
        const d = r.data ?? {};
        const items: Template[] = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : Array.isArray(d.content) ? d.content : [];
        setTemplates(items.filter(t => (t as any).status === "APPROVED" || !(t as any).status));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
            keyExtractor={t => String(t.id)}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>No approved templates</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={tpStyles.row} onPress={() => onSelect(item)} activeOpacity={0.7}>
                <Text style={tpStyles.name}>{item.metaTemplateName || item.name || "(unnamed)"}</Text>
                {!!item.category && <Text style={tpStyles.cat}>{item.category}</Text>}
                {!!item.body && <Text style={tpStyles.body} numberOfLines={2}>{item.body}</Text>}
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const tpStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  closeBtn: { backgroundColor: "#f1f5f9", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText: { color: "#475569", fontWeight: "600" },
  row: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  name: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  cat: { fontSize: 11, color: "#0f766e", marginTop: 3, fontWeight: "600" },
  body: { fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 17 },
});

// ─── Attachment action sheet ──────────────────────────────────────────────────

function AttachMenu({
  visible, onClose,
  onTemplate, onDocument,
}: {
  visible: boolean; onClose: () => void;
  onTemplate: () => void; onDocument: () => void;
}) {
  if (!visible) return null;
  return (
    <TouchableOpacity style={amStyles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={amStyles.sheet}>
        <TouchableOpacity style={amStyles.item} onPress={() => { onClose(); onTemplate(); }}>
          <Text style={amStyles.emoji}>📝</Text>
          <Text style={amStyles.label}>Send Template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={amStyles.item} onPress={() => { onClose(); onDocument(); }}>
          <Text style={amStyles.emoji}>📎</Text>
          <Text style={amStyles.label}>Send Document / Image</Text>
        </TouchableOpacity>
        <TouchableOpacity style={amStyles.cancel} onPress={onClose}>
          <Text style={amStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const amStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end", zIndex: 99 },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 30 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  emoji: { fontSize: 24 },
  label: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  cancel: { marginTop: 10, alignItems: "center", paddingVertical: 12 },
  cancelText: { fontSize: 15, color: "#ef4444", fontWeight: "600" },
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
  const flatListRef = useRef<FlatList>(null);
  const initialScrollDone = useRef(false);

  const load = useCallback(async (p = 0) => {
    if (p === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const data = await fetchMessages(inbox.contactId, p);
      const content = [...(data.content ?? [])].reverse();
      setMessages((prev) => (p === 0 ? content : [...content, ...prev]));
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
      if (p === 0) initialScrollDone.current = false;
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to load messages");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [inbox.contactId]);

  useEffect(() => {
    load(0);
    markAsRead(inbox.contactId).catch(() => {});
  }, []);

  const appendOptimistic = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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

  async function handleSendTemplate(template: Template) {
    setTemplatePickerOpen(false);
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
      });
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(err?.response?.data?.message || err?.message || "Failed to send template");
    } finally {
      setSending(false);
    }
  }

  async function handleSendDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];

      const mt = file.mimeType ?? "";
      const mediaType = mt.startsWith("image/") ? "IMAGE"
        : mt.startsWith("video/") ? "VIDEO"
        : mt.startsWith("audio/") ? "AUDIO"
        : "DOCUMENT";

      setSending(true);
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        mediaUrl: file.uri,
        mediaType,
        mediaFileName: file.name,
        direction: "OUTBOUND",
        createdAt: new Date().toISOString(),
        status: "SENT",
      };
      appendOptimistic(optimistic);

      const formData = new FormData();
      formData.append("file", {
        uri: Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri,
        name: file.name ?? "attachment",
        type: mt || "application/octet-stream",
      } as any);
      formData.append("contactId", String(inbox.contactId));
      formData.append("mediaType", mediaType);

      const uploadRes = await api.post("/api/media-assets/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const mediaUrl = uploadRes.data?.publicUrl || uploadRes.data?.url || uploadRes.data?.mediaUrl;

      if (mediaUrl) {
        await api.post("/api/messages/send-whatsapp/media", {
          contactId: inbox.contactId,
          mediaType,
          mediaUrl,
          fileName: file.name,
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to send file");
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

        {loadingMore && (
          <ActivityIndicator color="#0f766e" style={{ marginVertical: 8 }} />
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) =>
            String(item.id ?? item.messageId ?? item.createdAt ?? item.timestamp ?? index)
          }
          renderItem={({ item, index }) => (
            <MessageBubble message={item} prevMessage={messages[index - 1]} />
          )}
          onStartReached={() => {
            if (!loadingMore && page + 1 < totalPages) load(page + 1);
          }}
          onStartReachedThreshold={0.2}
          contentContainerStyle={styles.messageList}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => {
            if (!initialScrollDone.current) {
              flatListRef.current?.scrollToEnd({ animated: false });
              initialScrollDone.current = true;
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setAttachOpen(true)}>
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
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
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
        onDocument={handleSendDocument}
      />

      <TemplatePicker
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleSendTemplate}
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
  bubbleMeta: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end" },
  bubbleTime: { fontSize: 10, color: "#94a3b8" },
  bubbleTimeOut: { color: "rgba(255,255,255,0.65)" },
  statusIcon: { fontSize: 10 },
  mediaImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  mediaFile: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  mediaFileName: { fontSize: 13, color: "#1e293b", flex: 1 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
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
