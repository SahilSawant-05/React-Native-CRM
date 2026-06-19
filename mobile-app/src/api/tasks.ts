import api from "./client";
import { Task } from "../types";

function normalizeTaskList(data: any): Task[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchMyTasks(): Promise<Task[]> {
  try {
    const res = await api.get("/api/tasks", { params: { assignedToMe: true } });
    return normalizeTaskList(res.data);
  } catch (err: any) {
    // fallback: try without the assignedToMe param
    if (err?.response?.status === 400 || err?.response?.status === 404) {
      const res = await api.get("/api/tasks");
      return normalizeTaskList(res.data);
    }
    throw err;
  }
}

export async function updateTaskStatus(id: string | number, status: string): Promise<Task> {
  try {
    const res = await api.patch<Task>(`/api/tasks/${id}`, { status });
    return res.data;
  } catch {
    const res = await api.put<Task>(`/api/tasks/${id}/status`, { status });
    return res.data;
  }
}
