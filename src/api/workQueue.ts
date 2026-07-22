import api from "./client";
import { WorkQueue, WorkSection, WorkItem } from "../types";

function normalizeItem(raw: any, sectionKey: string, idx: number): WorkItem {
  return {
    // carry all raw fields through
    ...raw,
    // ensure a stable unique id
    id: raw.id ?? raw._id ?? raw.taskId ?? raw.contactId ?? `${sectionKey}-${idx}`,
    contactId: raw.contactId,
    title: raw.title ?? raw.subject ?? raw.opportunityTitle,
    contactName: raw.contactName ?? raw.name,
    contactPhone: raw.contactPhone ?? raw.phone,
    description: raw.description ?? raw.lastMessage ?? raw.opportunityStage,
    status: raw.status,
    priority: raw.priority,
    dueAt: raw.dueAt ?? raw.dueDate ?? raw.scheduledAt,
    occurredAt: raw.occurredAt ?? raw.createdAt,
    targetPath: raw.targetPath,
  };
}

function normalizeSection(raw: any, idx: number): WorkSection {
  const key = raw.key ?? raw.sectionKey ?? raw.type ?? raw.name ?? `section-${idx}`;
  const items: any[] = Array.isArray(raw.items) ? raw.items : [];
  return {
    key,
    label: raw.label ?? raw.title ?? key,
    description: raw.description,
    count: raw.count ?? raw.totalCount ?? items.length,
    items: items.map((item, i) => normalizeItem(item, key, i)),
  };
}

export async function fetchWorkQueue(): Promise<WorkQueue> {
  const res = await api.get("/api/work-queue/today");
  const data = res.data ?? {};
  const rawSections: any[] = Array.isArray(data.sections) ? data.sections : [];
  return {
    sections: rawSections.map((s, i) => normalizeSection(s, i)),
    totalCount: data.totalCount ?? rawSections.reduce((sum: number, s: any) => sum + (s.count ?? 0), 0),
    recommendedFocus: data.recommendedFocus,
    activeIndustryKey: data.activeIndustryKey,
  };
}
