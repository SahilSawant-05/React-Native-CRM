import api from "./client";
import { WorkQueue } from "../types";

export async function fetchWorkQueue(): Promise<WorkQueue> {
  const res = await api.get<WorkQueue>("/api/work-queue/today");
  return res.data;
}
