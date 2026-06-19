export interface User {
  id: number | string;
  email: string;
  role: "AGENT" | "ADMIN" | "OWNER";
  tenantId: number | string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
}

export interface Contact {
  id?: number | string;
  _id?: number | string;
  name: string;
  email?: string;
  phone?: string;
  tags?: string[];
  status?: string;
  createdAt?: string;
}

export interface Opportunity {
  id?: number | string;
  _id?: number | string;
  title: string;
  amount?: number;
  stage?: string;
  closeDate?: string;
  contactName?: string;
  contactId?: number | string;
  industry?: string;
  priority?: string;
  updatedAt?: string;
}

export interface Task {
  id?: number | string;
  _id?: number | string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueAt?: string;
  contactName?: string;
  assignedTo?: string;
}

export interface WorkItem {
  id?: number | string;
  contactId?: number | string;
  title?: string;
  contactName?: string;
  contactPhone?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueAt?: string;
  occurredAt?: string;
  targetPath?: string;
}

export interface WorkSection {
  key: string;
  label: string;
  description?: string;
  count: number;
  items: WorkItem[];
}

export interface WorkQueue {
  sections: WorkSection[];
  totalCount: number;
  recommendedFocus?: string;
  activeIndustryKey?: string;
}
