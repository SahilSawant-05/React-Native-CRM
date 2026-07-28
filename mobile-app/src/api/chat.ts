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
  mediaId?: string | number;      // inbound WhatsApp media (no public URL — fetch via /api/messages/{id}/media)
  mediaMimeType?: string;
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
      // The backend inbox search param is `query` (see web Chat.jsx loadInbox).
      // Sending only `search` was ignored server-side, so search fell back to
      // filtering just the already-loaded pages — broken for large inboxes.
      // Send both names so it works regardless of the backend's expectation.
      ...(params.search ? { query: params.search, search: params.search } : {}),
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
  // Raw page fetch. NOTE: this backend paginates messages ASCENDING
  // (verified on-device: page 0 = the OLDEST 30 messages; the newest live
  // on the LAST page). It also ignores a `sort` request param. Use
  // fetchLatestMessages() below to get the newest window.
  const res = await api.get(`/api/messages/contact/${contactId}/page`, {
    params: { page, size: 30 },
  });
  return normalizePage<Message>(res.data, "items", (raw, idx) => `msg-${contactId}-${raw.createdAt ?? raw.timestamp ?? idx}`);
}

export interface LatestMessagesWindow {
  content: Message[];
  totalPages: number;
  /** true when the backend pages oldest→newest (newest on the last page) */
  ascending: boolean;
  /** next page to fetch when the user scrolls up for older history, or null when exhausted */
  nextOlderPage: number | null;
}

function pageIdNum(m?: Message): number {
  const n = Number(m?.id ?? m?.messageId);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Fetches the NEWEST window of a conversation regardless of the backend's
 * page direction. Detects ordering from page 0 (ids are monotonic): if
 * ascending, the newest messages are on the LAST page, so that page (plus
 * the one before it, to always have a full screen) is fetched too.
 */
export async function fetchLatestMessages(contactId: string | number): Promise<LatestMessagesWindow> {
  const p0 = await fetchMessages(contactId, 0);
  const items0 = p0.content;
  const totalPages = Math.max(1, p0.totalPages || 1);

  const firstId = pageIdNum(items0[0]);
  const lastId = pageIdNum(items0[items0.length - 1]);
  const ascending =
    items0.length >= 2 && Number.isFinite(firstId) && Number.isFinite(lastId)
      ? firstId < lastId
      : true; // verified backend behaviour; assume ascending when undecidable

  if (!ascending) {
    // Descending backend: page 0 already IS the newest window.
    return {
      content: items0,
      totalPages,
      ascending,
      nextOlderPage: totalPages > 1 ? 1 : null,
    };
  }

  if (totalPages === 1) {
    return { content: items0, totalPages, ascending, nextOlderPage: null };
  }

  // Ascending: newest messages are on the last page. Fetch it, and if it's
  // sparse also the page before, so the thread always fills the screen.
  const lastPage = await fetchMessages(contactId, totalPages - 1);
  let content = lastPage.content;
  let fetchedDownTo = totalPages - 1;
  if (content.length < 30 && totalPages >= 2) {
    const prev = await fetchMessages(contactId, totalPages - 2);
    content = [...prev.content, ...content];
    fetchedDownTo = totalPages - 2;
  }
  return {
    content,
    totalPages,
    ascending,
    nextOlderPage: fetchedDownTo - 1 >= 0 ? fetchedDownTo - 1 : null,
  };
}

export async function markAsRead(contactId: string | number): Promise<void> {
  await api.post(`/api/inbox/${contactId}/read`);
}

export async function sendTextMessage(contactId: string | number, body: string): Promise<void> {
  await api.post("/api/messages/send-whatsapp", { contactId, text: body });
}