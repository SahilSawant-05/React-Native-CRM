import api from "./client";
import { Contact } from "../types";

export interface ContactsPage {
  content: Contact[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export async function fetchContacts(params: {
  page?: number;
  size?: number;
  search?: string;
}): Promise<ContactsPage> {
  const res = await api.get<ContactsPage>("/api/contacts/search/page", {
    params: { page: params.page ?? 0, size: params.size ?? 20, search: params.search ?? "" },
  });
  return res.data;
}

export async function fetchContactById(id: string | number): Promise<Contact> {
  const res = await api.get<Contact>(`/api/contacts/${id}`);
  return res.data;
}

export async function fetchContactTimeline(id: string | number): Promise<any[]> {
  const res = await api.get<any[]>(`/api/contacts/${id}/timeline`);
  return res.data;
}
