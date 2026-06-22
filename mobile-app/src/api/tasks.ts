import api from "./client";
import { Task } from "../types";

function normalizeTaskList(data: any): Task[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchMyTasks(): Promise<Task[]> {
  const endpoints = ["/api/tasks/my-tasks", "/api/tasks?assignedToMe=true", "/api/tasks"];
  let lastErr: any;
  for (const url of endpoints) {
    try {
      const res = await api.get(url);
      return normalizeTaskList(res.data);
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status !== 404 && status !== 400 && status !== 405 && status !== 500) throw err;
    }
  }
  throw lastErr;
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
