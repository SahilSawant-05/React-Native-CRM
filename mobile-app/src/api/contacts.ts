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

export interface ContactFilters {
  tag?: string;
  stage?: string;
  leadSource?: string;
  city?: string;
  conversationStatus?: string;
  assignedUserId?: string;
  // Web parity (Contacts.jsx): sent alongside `stage` so the backend can
  // disambiguate which pipeline's stage key to match. Without it, a stage
  // filter can silently fail to narrow results on tenants with a custom
  // pipeline whose stage keys differ from the legacy defaults.
  pipelineId?: string;
}

export async function fetchContacts(params: {
  page?: number;
  size?: number;
  search?: string;
  filters?: ContactFilters;
}): Promise<ContactsPage> {
  // Only send filter values that are actually set (web parity: the web omits
  // empty filter params from /api/contacts/search/page).
  const f = params.filters ?? {};
  const filterParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v != null && String(v).trim() !== "") filterParams[k] = String(v).trim();
  }
  try {
    const res = await api.get("/api/contacts/search/page", {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        ...(params.search ? { query: params.search } : {}),
        ...filterParams,
      },
    });
    return normalizePage(res.data);
  } catch (err: any) {
    const hasQuery = !!params.search || Object.keys(filterParams).length > 0;
    // Only fall back to the plain /api/contacts endpoint for an UNFILTERED
    // load. Falling back while a search/filter is active would ignore it and
    // return every contact — which looks exactly like "the filter doesn't
    // work". Surface the error instead so a real problem is visible.
    if (!hasQuery && (err?.response?.status === 404 || err?.response?.status === 400)) {
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

// Web parity (Contacts.jsx): PUT /api/contacts/{id} to edit, DELETE to remove.
export async function updateContact(id: string | number, payload: Partial<Contact>): Promise<Contact> {
  const res = await api.put<Contact>(`/api/contacts/${id}`, payload);
  return res.data;
}

export async function deleteContact(id: string | number): Promise<void> {
  await api.delete(`/api/contacts/${id}`);
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
