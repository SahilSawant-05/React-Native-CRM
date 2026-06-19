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
  id: number | string;
  body?: string;
  text?: string;
  direction: "INBOUND" | "OUTBOUND";
  type?: string;
  mediaUrl?: string;
  createdAt?: string;
  timestamp?: string;
  status?: string;
}

export interface MessagesPage {
  content: Message[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export async function fetchInbox(params: {
  page?: number;
  size?: number;
  status?: string;
  search?: string;
}): Promise<InboxPage> {
  const res = await api.get<InboxPage>("/api/inbox/page", {
    params: { page: params.page ?? 0, size: params.size ?? 20, status: params.status, search: params.search },
  });
  return res.data;
}

export async function fetchMessages(contactId: string | number, page = 0): Promise<MessagesPage> {
  const res = await api.get<MessagesPage>(`/api/messages/contact/${contactId}/page`, {
    params: { page, size: 30, sort: "createdAt,desc" },
  });
  return res.data;
}

export async function markAsRead(contactId: string | number): Promise<void> {
  await api.post(`/api/inbox/${contactId}/read`);
}

export async function sendTextMessage(contactId: string | number, body: string): Promise<void> {
  await api.post("/api/messages/send-whatsapp", { contactId, body });
}
