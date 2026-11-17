/** Talks to the user's TakaLeaf server: bearer token, one refresh on 401, problem responses as errors. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field errors from a validation problem: field → first message. */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** The refresh token is gone or refused: the person must sign in again. Local data and the outbox stay. */
export class SignedOutError extends Error {
  constructor() {
    super("Your session has ended. Sign in again; your changes on this phone are kept.");
  }
}

/** The phone could not reach the server at all. */
export class OfflineError extends Error {
  constructor() {
    super("No connection to your server. Your changes are kept on this phone.");
  }
}

export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string | null;
  user: AuthUser;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

async function problemOf(response: Response): Promise<ApiError> {
  let body: { title?: string; detail?: string; errors?: Record<string, string[]> } = {};
  try {
    body = await response.json();
  } catch {
    // Not JSON: keep the status alone.
  }
  const fields = Object.fromEntries(Object.entries(body.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? ""]));
  const first = Object.values(fields)[0];
  return new ApiError(response.status, first ?? body.title ?? body.detail ?? `The server answered ${response.status}.`, fields);
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor(
    readonly serverUrl: string,
    private readonly tokens: TokenStore,
    private readonly fetchImpl: Fetch = (url, init) => fetch(url, init),
  ) {}

  private url(path: string) {
    return `${this.serverUrl.replace(/\/+$/, "")}/api${path}`;
  }

  private async send(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
    if (init.body) headers["Content-Type"] = "application/json";
    if (auth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    try {
      return await this.fetchImpl(this.url(path), { ...init, headers });
    } catch {
      throw new OfflineError();
    }
  }

  /** Calls the API; on 401 refreshes the access token once and tries again. */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.accessToken) await this.refresh();
    let response = await this.send(path, init);
    if (response.status === 401) {
      if (!(await this.refresh())) throw new SignedOutError();
      response = await this.send(path, init);
    }
    if (response.status === 401) throw new SignedOutError();
    if (!response.ok) throw await problemOf(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** For sign-in screens: no token, errors as ApiError. */
  async anonymous<T>(path: string, body: unknown): Promise<T> {
    const response = await this.send(path, { method: "POST", body: JSON.stringify(body) }, false);
    if (!response.ok) throw await problemOf(response);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const result = await this.anonymous<AuthResponse>("/auth/login", { email, password, client: "mobile" });
    await this.accept(result);
    return result.user;
  }

  async signOut(): Promise<void> {
    const refreshToken = await this.tokens.getRefreshToken();
    try {
      if (refreshToken) await this.send("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
    } catch {
      // Offline: the token is dropped here anyway.
    }
    this.accessToken = null;
    await this.tokens.setRefreshToken(null);
  }

  private async accept(result: AuthResponse) {
    this.accessToken = result.accessToken;
    if (result.refreshToken) await this.tokens.setRefreshToken(result.refreshToken);
  }

  /** Trades the stored refresh token for a new pair. False when there is none or the server refused it. */
  refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      try {
        const refreshToken = await this.tokens.getRefreshToken();
        if (!refreshToken) return false;
        const response = await this.send("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }, false);
        if (response.status === 401 || response.status === 400) {
          await this.tokens.setRefreshToken(null);
          return false;
        }
        if (!response.ok) throw await problemOf(response);
        await this.accept((await response.json()) as AuthResponse);
        return true;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }
}
