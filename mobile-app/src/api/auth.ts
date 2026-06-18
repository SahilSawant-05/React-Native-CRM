import api from "./client";

export interface LoginResponse {
  token: string;
  role: string;
  tenantId: number;
  userId: number;
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/auth/login", { email, password });
  return res.data;
}
