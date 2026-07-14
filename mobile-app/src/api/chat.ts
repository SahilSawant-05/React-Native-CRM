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
  // IMPORTANT: explicit newest-first sort.
  //
  // Previously this request had no `sort` param and relied on "the
  // backend's default ordering", on the assumption that page 0 = the 30
  // most recent messages. If the backend's default order is actually
  // ascending (oldest-first) — which is a common default for a simple
  // `findByContactId` query — then page 0 is really the OLDEST 30
  // messages in the whole conversation. In that case a brand-new message
  // can NEVER show up in page 0, no matter how many times the poll runs:
  // it would only become visible once enough pages had been paged through
  // (or never, on a long thread). That matches "push notification arrives
  // but the open chat screen never shows the new message" exactly, since
  // the notification comes from a separate channel that isn't affected by
  // this pagination bug.
  //
  // Sending sort explicitly removes the guess. Confirm this matches your
  // backend's actual sort syntax (Spring Data JPA typically accepts
  // `sort=createdAt,desc`; adjust the field name/format if your API uses
  // something else, e.g. `sort=-createdAt` or `sortBy`/`sortDir` params).
  const res = await api.get(`/api/messages/contact/${contactId}/page`, {
    params: { page, size: 30, sort: "createdAt,desc" },
  });

  if (__DEV__) {
    const items = res.data?.items ?? res.data?.content ?? [];
    console.log(
      `[chat api] fetchMessages page=${page} got ${items.length} items, ` +
      `first=${JSON.stringify(items[0]?.createdAt ?? items[0]?.timestamp)} ` +
      `last=${JSON.stringify(items[items.length - 1]?.createdAt ?? items[items.length - 1]?.timestamp)}`
    );
  }

  return normalizePage<Message>(res.data, "items", (raw, idx) => `msg-${contactId}-${raw.createdAt ?? raw.timestamp ?? idx}`);
}

export async function markAsRead(contactId: string | number): Promise<void> {
  await api.post(`/api/inbox/${contactId}/read`);
}

export async function sendTextMessage(contactId: string | number, body: string): Promise<void> {
  await api.post("/api/messages/send-whatsapp", { contactId, text: body });
}