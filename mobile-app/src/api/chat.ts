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
  return normalizePage<InboxItem>(res.data, "items", (raw, idx) => `inbox-${raw.contactId ?? raw.contactPhone ?? idx}`);
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
  await api.post("/api/messages/send-whatsapp", { contactId, body });
}
