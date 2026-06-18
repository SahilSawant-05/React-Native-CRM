import api from "./client";
import { Opportunity } from "../types";

export interface OpportunitiesPage {
  content: Opportunity[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export async function fetchOpportunities(params: {
  page?: number;
  size?: number;
  stage?: string;
}): Promise<OpportunitiesPage> {
  const res = await api.get<OpportunitiesPage>("/api/opportunities/page", {
    params: { page: params.page ?? 0, size: params.size ?? 20, stage: params.stage },
  });
  return res.data;
}

export async function fetchOpportunityById(id: string | number): Promise<Opportunity> {
  const res = await api.get<Opportunity>(`/api/opportunities/${id}`);
  return res.data;
}

export async function updateOpportunityStage(
  id: string | number,
  stage: string
): Promise<Opportunity> {
  const res = await api.put<Opportunity>(`/api/opportunities/${id}/stage`, { stage });
  return res.data;
}
