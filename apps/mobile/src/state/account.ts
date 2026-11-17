import { ApiClient, type AuthUser } from "../api/client";
import { DEFAULT_SERVER_URL } from "../api/health";
import { secureTokens } from "../api/tokens";
import { db } from "../db/client";
import { getSetting, setSetting } from "../db/store";

export const SERVER_URL_KEY = "server.url";
export const USER_KEY = "account.user";

/** The account last signed in on this phone, kept so the app opens offline. */
export function storedUser(): AuthUser | null {
  const raw = getSetting(db, USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function storeUser(user: AuthUser): void {
  setSetting(db, USER_KEY, JSON.stringify(user));
}

export const serverUrl = () => getSetting(db, SERVER_URL_KEY) ?? DEFAULT_SERVER_URL;

let client: ApiClient | null = null;

/** One API client per server address, shared by the screens and the background task. */
export function apiClient(): ApiClient {
  const url = serverUrl();
  if (!client || client.serverUrl !== url) client = new ApiClient(url, secureTokens);
  return client;
}
