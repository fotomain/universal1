// The client of the converter service (py/bim/server/server.py): POST /convert -> a job -> GET /jobs/<id> until it is done.
// The user's Supabase token travels in the Authorization header: the server asks Supabase who it is and uploads the chunks into Storage WITH THAT TOKEN.
import type { BimBundle, BimGranularity } from './bimImportModel';

export interface BimServerConfig {
  baseUrl: string;
  /** the access token of the signed-in user (null = development server without login) */
  getToken: () => Promise<string | null>;
}

export type BimConvertSource = { kind: 'url'; url: string } | { kind: 'bytes'; bytes: ArrayBuffer | Uint8Array | Blob; name: string };

export interface BimConvertParams {
  projectGUID: string;
  modelGUID: string;
  name?: string;
  granularity?: BimGranularity;
  skipEmpty?: boolean;
  startDate?: string;
  sourceName?: string;
}

export class BimServerError extends Error {}

/** the url of the converter: .env EXPO_PUBLIC_BIM_SERVER_URL (the owner edits .env; empty = the converter is not set up) */
export const bimServerUrl = (): string => String((typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_BIM_SERVER_URL) || '').replace(/\/+$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function convertQuery(p: BimConvertParams): string {
  const q = new URLSearchParams();
  q.set('projectGUID', p.projectGUID);
  q.set('modelGUID', p.modelGUID);
  if (p.name) q.set('name', p.name);
  if (p.granularity) q.set('granularity', p.granularity);
  if (p.skipEmpty === false) q.set('skipEmpty', '0');
  if (p.startDate) q.set('startDate', p.startDate);
  if (p.sourceName) q.set('sourceName', p.sourceName);
  return q.toString();
}

export async function convertOnServer(
  cfg: BimServerConfig,
  params: BimConvertParams,
  source: BimConvertSource,
  onProgress: (percent: number, text: string) => void = () => {},
  fetchImpl?: typeof fetch,
  pollMs = 800,
  timeoutMs = 20 * 60 * 1000
): Promise<BimBundle> {
  const fetchFn: typeof fetch = fetchImpl ?? ((...a) => fetch(...a));
  if (!cfg.baseUrl) throw new BimServerError('The converter is not set up: add EXPO_PUBLIC_BIM_SERVER_URL to .env (see kit8/pm/bim/README.md).');
  const token = await cfg.getToken();
  const auth: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const body = source.kind === 'url' ? JSON.stringify({ url: source.url }) : (source.bytes as any);
  const headers = { ...auth, 'Content-Type': source.kind === 'url' ? 'application/json' : 'application/octet-stream' };
  const q = convertQuery({ ...params, sourceName: params.sourceName ?? (source.kind === 'bytes' ? source.name : undefined) });
  let res: Response;
  try {
    res = await fetchFn(`${cfg.baseUrl}/convert?${q}`, { method: 'POST', headers, body });
  } catch (e) {
    throw new BimServerError(`The converter cannot be reached (${cfg.baseUrl}). Is it running? ${(e as Error).message}`);
  }
  const started = await res.json().catch(() => ({}));
  if (!res.ok || !started.jobId) throw new BimServerError(started.error || `The converter refused the file (${res.status}).`);
  const t0 = Date.now();
  for (;;) {
    await sleep(pollMs);
    const r = await fetchFn(`${cfg.baseUrl}/jobs/${started.jobId}`, { headers: auth });
    const job = await r.json().catch(() => ({}));
    if (!r.ok) throw new BimServerError(job.error || `The converter job cannot be read (${r.status}).`);
    onProgress(Number(job.progress) || 0, String(job.stepText || ''));
    if (job.state === 'done') return job.result as BimBundle;
    if (job.state === 'failed') throw new BimServerError(job.error || 'The conversion failed.');
    if (Date.now() - t0 > timeoutMs) throw new BimServerError('The conversion takes too long.');
  }
}
