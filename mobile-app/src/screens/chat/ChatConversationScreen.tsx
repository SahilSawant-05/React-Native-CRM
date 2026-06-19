import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import { ErrorBanner } from "../../components/common/ErrorBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

type Props = {
  route: RouteProp<{ ChatConversation: { inbox: InboxItem } }, "ChatConversation">;
  navigation?: any;
};

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
  if (s === "READ") {
    return <Text style={[styles.statusIcon, { color: "#38bdf8" }]}> ✓✓</Text>;
  }
  if (s === "DELIVERED") {
    return <Text style={[styles.statusIcon, { color: "rgba(255,255,255,0.8)" }]}> ✓✓</Text>;
  }
  return <Text style={[styles.statusIcon, { color: "rgba(255,255,255,0.55)" }]}> ✓</Text>;
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

export default function ChatConversationScreen({ route }: Props) {
  const { inbox } = route.params;
  // messages[0] = oldest, messages[last] = newest (chronological order)
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const flatListRef = useRef<FlatList>(null);
  const initialScrollDone = useRef(false);

  const load = useCallback(async (p = 0) => {
    if (p === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const data = await fetchMessages(inbox.contactId, p);
      // API returns desc (newest first) — reverse to get oldest-first for display
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
    // Append so it appears at the bottom
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
          // Scroll to top loads older messages
          onStartReached={() => { if (!loadingMore && page + 1 < totalPages) load(page + 1); }}
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
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyChatText: { color: "#94a3b8", fontSize: 14 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 10,
  },
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
