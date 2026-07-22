import AsyncStorage from "@react-native-async-storage/async-storage";

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const ALL_KEYS = ["crm_token", "crm_role", "crm_tenantId", "crm_user", "crm_lastActivityAt"];

export function decodeToken(token: string | null): Record<string, any> | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now();
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("crm_token");
}

export async function markActivity(): Promise<void> {
  const token = await AsyncStorage.getItem("crm_token");
  if (token) {
    await AsyncStorage.setItem("crm_lastActivityAt", String(Date.now()));
  }
}

export async function isIdleExpired(): Promise<boolean> {
  const token = await AsyncStorage.getItem("crm_token");
  if (!token) return false;
  const lastActivityAt = Number(
    (await AsyncStorage.getItem("crm_lastActivityAt")) || Date.now()
  );
  return Date.now() - lastActivityAt > IDLE_TIMEOUT_MS;
}

export async function saveAuthSession(data: {
  token: string;
  role: string;
  tenantId: string | number;
  user: object;
}): Promise<void> {
  await AsyncStorage.multiSet([
    ["crm_token", data.token],
    ["crm_role", data.role],
    ["crm_tenantId", String(data.tenantId)],
    ["crm_user", JSON.stringify(data.user)],
    ["crm_lastActivityAt", String(Date.now())],
  ]);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove(ALL_KEYS);
}

export async function loadStoredSession(): Promise<{
  token: string | null;
  role: string | null;
  tenantId: string | null;
  user: string | null;
}> {
  const pairs = await AsyncStorage.multiGet(["crm_token", "crm_role", "crm_tenantId", "crm_user"]);
  const [token, role, tenantId, user] = pairs.map(([, v]) => v);
  return { token, role, tenantId, user };
}
