// files-drive - the access token of an organization's connected Google account: cached, refreshed by itself, one refresh at a time.
//   * An access token lives about one hour (observed 3598 s). A cached token is used while it has more than 5 minutes left.
//   * The refresh token is stored ENCRYPTED (FILES_TOKEN_KEY); invalid_grant (revoked, password changed, unused about 6 months, Google app in Testing for 7 days)
//     marks the connection needsReconnect - the app shows "Google Drive is disconnected - reconnect".
import { decryptToken } from './crypto.ts';
import type { FetchFn } from './googleDrive.ts';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class NeedsReconnectError extends Error {
  code = 'needsReconnect';
  constructor(message = 'Google Drive is disconnected - reconnect.') {
    super(message);
  }
}

export interface TokenDeps {
  fetchFn: FetchFn;
  clientId: string;
  clientSecret: string;
  tokenKey: string;
  now: () => number;
  /** the stored connection of the organization (null = not connected) */
  loadConnection: (organization: string) => Promise<{ refreshTokenEncrypted?: string; state?: string } | null>;
  markNeedsReconnect: (organization: string, error: string) => Promise<void>;
  /** after a successful refresh: lastRefreshAt, state ok */
  markRefreshed: (organization: string, iso: string) => Promise<void>;
}

export function createTokenProvider(deps: TokenDeps) {
  const cache = new Map<string, { token: string; expiresAt: number }>();
  const inflight = new Map<string, Promise<string>>();

  async function refresh(organization: string): Promise<string> {
    const conn = await deps.loadConnection(organization);
    if (!conn || !conn.refreshTokenEncrypted) throw new NeedsReconnectError('Google Drive is not connected.');
    if (conn.state === 'needsReconnect') throw new NeedsReconnectError();
    const refreshToken = await decryptToken(conn.refreshTokenEncrypted, deps.tokenKey);
    const res = await deps.fetchFn(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: deps.clientId, client_secret: deps.clientSecret }).toString(),
    });
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (!res.ok || !body.access_token) {
      if (body.error === 'invalid_grant' || res.status === 400 || res.status === 401) {
        await deps.markNeedsReconnect(organization, String(body.error_description || body.error || `HTTP ${res.status}`).slice(0, 300));
        throw new NeedsReconnectError();
      }
      throw new Error(`Google token refresh failed (HTTP ${res.status}).`);
    }
    const expiresAt = deps.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000;
    cache.set(organization, { token: body.access_token, expiresAt });
    await deps.markRefreshed(organization, new Date(deps.now()).toISOString());
    return body.access_token as string;
  }

  return {
    /** a valid access token; force = ignore the cache (after a Drive 401) */
    async getAccessToken(organization: string, force = false): Promise<string> {
      const hit = cache.get(organization);
      if (!force && hit && hit.expiresAt - deps.now() > REFRESH_MARGIN_MS) return hit.token;
      let pending = inflight.get(organization);
      if (!pending) {
        pending = refresh(organization).finally(() => inflight.delete(organization));
        inflight.set(organization, pending);
      }
      return pending;
    },
    /** the token the consent step just got (so the first call needs no refresh) */
    prime(organization: string, token: string, expiresInSeconds: number): void {
      cache.set(organization, { token, expiresAt: deps.now() + expiresInSeconds * 1000 });
    },
    forget(organization: string): void {
      cache.delete(organization);
    },
  };
}

export type TokenProvider = ReturnType<typeof createTokenProvider>;
