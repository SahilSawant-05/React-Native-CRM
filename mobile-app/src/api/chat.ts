import api from "./client";

export interface InboxItem {
  contactId: number | string;
  contactName: string;
  contactPhone?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  status?: string;
  assignedAgentName?: string;
}

export interface InboxPage {
  content: InboxItem[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface Message {
  id?: number | string;
  messageId?: number | string;
  textBody?: string;   // primary content field from API
  body?: string;       // fallback
  text?: string;       // fallback
  direction: "INBOUND" | "OUTBOUND";
  type?: string;
  mediaType?: string;
  mediaUrl?: string;
  mediaFileName?: string;
  createdAt?: string;
  timestamp?: string;
  status?: string;
  errorMessage?: string;
}

export interface MessagesPage {
  content: Message[];
  totalElements: number;
  totalPages: number;
  number: number;
}

// API returns { items: [], totalElements, totalPages, page }
function normalizePage<T>(data: any, key = "items", assignId?: (raw: any, idx: number) => string): { content: T[]; totalElements: number; totalPages: number; number: number } {
  const raw: any[] =
    Array.isArray(data?.[key]) ? data[key] :
    Array.isArray(data?.content) ? data.content :
    Array.isArray(data?.items) ? data.items :
    Array.isArray(data) ? data : [];
  const items: T[] = assignId
    ? raw.map((item, idx) => ({ ...item, id: item.id ?? item._id ?? item.messageId ?? assignId(item, idx) }))
    : raw;
  return {
    content: items,
    totalElements: data?.totalElements ?? items.length,
    totalPages: data?.totalPages ?? 1,
    number: data?.page ?? data?.number ?? 0,
  };
}

// Backend inbox field names aren't guaranteed to match InboxItem exactly
// (same situation as Message.textBody/body/text below). This tries every
// reasonable variant so the preview text actually shows up regardless of
// what the backend calls it.
function normalizeInboxItem(raw: any): InboxItem {
  const lastMessage =
    raw.lastMessage ??
    raw.lastMessageText ??
    raw.lastMessagePreview ??
    raw.lastMessageBody ??
    raw.message ??
    raw.messagePreview ??
    raw.preview ??
    raw.snippet ??
    raw.textBody ??
    raw.body ??
    raw.text ??
    undefined;

  const lastMessageAt =
    raw.lastMessageAt ??
    raw.lastMessageTime ??
    raw.lastMessageTimestamp ??
    raw.lastMessageDate ??
    raw.updatedAt ??
    raw.timestamp ??
    raw.createdAt ??
    undefined;

  return {
    contactId: raw.contactId,
    contactName: raw.contactName,
    contactPhone: raw.contactPhone,
    lastMessage,
    lastMessageAt,
    unreadCount: raw.unreadCount ?? raw.unread ?? 0,
    status: raw.status,
    assignedAgentName: raw.assignedAgentName ?? raw.agentName,
  };
}

export async function fetchInbox(params: {
  page?: number;
  size?: number;
  status?: string;
  search?: string;
}): Promise<InboxPage> {
  const res = await api.get("/api/inbox/page", {
    params: {
      page: params.page ?? 0,
      size: params.size ?? 20,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });

  // TEMP DEBUG — remove once confirmed. Logs the raw first item so we can
  // see the exact field name the backend uses for the message preview.
  const firstRaw = res.data?.items?.[0] ?? res.data?.content?.[0] ?? res.data?.[0];
  if (firstRaw) {
    // console.log("RAW INBOX ITEM:", JSON.stringify(firstRaw, null, 2));
  }

  const page = normalizePage<any>(res.data, "items", (raw, idx) => `inbox-${raw.contactId ?? raw.contactPhone ?? idx}`);

  return {
    ...page,
    content: page.content.map(normalizeInboxItem),
  };
}

export async function fetchMessages(contactId: string | number, page = 0): Promise<MessagesPage> {
  const res = await api.get(`/api/messages/contact/${contactId}/page`, {
    params: { page, size: 30, sort: "createdAt,desc" },
  });
  return normalizePage<Message>(res.data, "items", (raw, idx) => `msg-${contactId}-${raw.createdAt ?? raw.timestamp ?? idx}`);
}

export async function markAsRead(contactId: string | number): Promise<void> {
  await api.post(`/api/inbox/${contactId}/read`);
}

export async function sendTextMessage(contactId: string | number, body: string): Promise<void> {
  await api.post("/api/messages/send-whatsapp", { contactId, text: body });
}