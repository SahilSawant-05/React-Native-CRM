import api from "./client";
import { Contact } from "../types";

export interface ContactsPage {
  content: Contact[];
  totalElements: number;
  totalPages: number;
  number: number;
}

// The API returns { items: [], totalElements, totalPages, page, hasNext }
function normalizePage(data: any): ContactsPage {
  if (Array.isArray(data)) {
    return { content: data, totalElements: data.length, totalPages: 1, number: 0 };
  }
  // Primary shape from /api/contacts/search/page
  if (Array.isArray(data?.items)) {
    return {
      content: data.items,
      totalElements: data.totalElements ?? data.items.length,
      totalPages: data.totalPages ?? 1,
      number: data.page ?? 0,
    };
  }
  // Spring Boot page shape
  if (Array.isArray(data?.content)) {
    return {
      content: data.content,
      totalElements: data.totalElements ?? data.content.length,
      totalPages: data.totalPages ?? 1,
      number: data.number ?? 0,
    };
  }
  if (Array.isArray(data?.data)) {
    return { content: data.data, totalElements: data.data.length, totalPages: 1, number: 0 };
  }
  return { content: [], totalElements: 0, totalPages: 1, number: 0 };
}

export async function fetchContacts(params: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ContactsPage> {
  try {
    const res = await api.get("/api/contacts/search/page", {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.search ? { search: params.search } : {}),
      },
    });
    return normalizePage(res.data);
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 400) {
      const res = await api.get("/api/contacts", {
        params: { page: params.page ?? 0, size: params.size ?? 20 },
      });
      return normalizePage(res.data);
    }
    throw err;
  }
}

export async function fetchContactById(id: string | number): Promise<Contact> {
  const res = await api.get<Contact>(`/api/contacts/${id}`);
  return res.data;
}

export async function fetchContactTimeline(id: string | number): Promise<any[]> {
  try {
    const res = await api.get(`/api/contacts/${id}/timeline`);
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.items)) return res.data.items;
    if (Array.isArray(res.data?.content)) return res.data.content;
    return [];
  } catch {
    return [];
  }
}
