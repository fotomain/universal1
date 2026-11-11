// files-drive - the access token of an organization's connected Google account: cached, refreshed by itself, one refresh at a time.
//   * An access token lives about one hour (observed 3598 s). A cached token is used while it has more than 5 minutes left.
//   * The refresh token is stored ENCRYPTED (FILES_TOKEN_KEY); invalid_grant (revoked, password changed, unused about 6 months, Google app in Testing for 7 days)
//     marks the connection needsReconnect - the app shows "Google Drive is disconnected - reconnect".
import { decryptToken, encryptToken } from './crypto.ts';
import type { FetchFn, StorageProvider } from './provider.ts';
import { createGoogleProvider } from './googleProvider.ts';

export { GOOGLE_TOKEN_URL } from './googleProvider.ts';
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class NeedsReconnectError extends Error {
  code = 'needsReconnect';
  constructor(message = 'Google Drive is disconnected - reconnect.') {
    super(message);
  }
}

export interface TokenDeps {
  fetchFn: FetchFn;
  /** the storage the token belongs to (default: Google Drive) */
  provider?: StorageProvider;
  clientId: string;
  clientSecret: string;
  tokenKey: string;
  now: () => number;
  /** the stored connection of the organization (null = not connected) */
  loadConnection: (organization: string) => Promise<{ refreshTokenEncrypted?: string; state?: string } | null>;
  markNeedsReconnect: (organization: string, error: string) => Promise<void>;
  /** after a successful refresh: lastRefreshAt, state ok */
  markRefreshed: (organization: string, iso: string) => Promise<void>;
  /** a storage whose refresh token ROTATES (OneDrive) answers a refresh with a NEW token: it is stored (encrypted) before the access token is used. Google never rotates: not called. */
  saveRefreshToken?: (organization: string, refreshTokenEncrypted: string) => Promise<void>;
}

export function createTokenProvider(deps: TokenDeps) {
  const cache = new Map<string, { token: string; expiresAt: number }>();
  const inflight = new Map<string, Promise<string>>();
  const provider = deps.provider ?? createGoogleProvider(deps.fetchFn);

  async function refresh(organization: string): Promise<string> {
    const conn = await deps.loadConnection(organization);
    if (!conn || !conn.refreshTokenEncrypted) throw new NeedsReconnectError('Google Drive is not connected.');
    if (conn.state === 'needsReconnect') throw new NeedsReconnectError();
    const refreshToken = await decryptToken(conn.refreshTokenEncrypted, deps.tokenKey);
    const r = await provider.refresh({ refreshToken, clientId: deps.clientId, clientSecret: deps.clientSecret });
    if (!r.ok) {
      if (r.revoked) {
        await deps.markNeedsReconnect(organization, r.error.slice(0, 300));
        throw new NeedsReconnectError();
      }
      throw new Error(`${provider.title} token refresh failed (HTTP ${r.status}).`);
    }
    if (r.refreshToken && deps.saveRefreshToken) await deps.saveRefreshToken(organization, await encryptToken(r.refreshToken, deps.tokenKey));
    const expiresAt = deps.now() + Math.max(60, r.expiresInSeconds) * 1000;
    cache.set(organization, { token: r.accessToken, expiresAt });
    await deps.markRefreshed(organization, new Date(deps.now()).toISOString());
    return r.accessToken;
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
