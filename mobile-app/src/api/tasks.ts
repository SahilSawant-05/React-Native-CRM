import api from "./client";
import { Task } from "../types";

export async function fetchMyTasks(): Promise<Task[]> {
  const res = await api.get<Task[]>("/api/tasks", { params: { assignedToMe: true } });
  return res.data;
}

export async function updateTaskStatus(id: string | number, status: string): Promise<Task> {
  const res = await api.patch<Task>(`/api/tasks/${id}`, { status });
  return res.data;
}
