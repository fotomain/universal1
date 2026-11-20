import { convertOnServer, convertQuery, BimServerError, bimServerUrl } from '../../kit8/pm/bim/import/bimServerClient';

const resp = (body: any, ok = true, status = 200) => ({ ok, status, json: async () => body }) as any;

describe('the converter client', () => {
  const cfg = { baseUrl: 'http://conv', getToken: async () => 'TOKEN' };
  const params = { projectGUID: 'p', modelGUID: 'm', granularity: 'group' as const, skipEmpty: false, startDate: '2026-11-23' };

  it('an url source: JSON body, the token in the header, polls until done and reports progress', async () => {
    const seen: any[] = [];
    const states = [{ state: 'running', progress: 30, stepText: 'Geometry' }, { state: 'done', progress: 100, stepText: 'Done', result: { ok: 1 } }];
    const fetchFn: any = jest.fn(async (url: string, init: any) => {
      seen.push([url, init]);
      return url.includes('/convert') ? resp({ jobId: 'J' }, true, 202) : resp(states.shift());
    });
    const progress: number[] = [];
    const out = await convertOnServer(cfg, params, { kind: 'url', url: 'https://x/y.ifc' }, (p) => progress.push(p), fetchFn, 1);
    expect(out).toEqual({ ok: 1 });
    expect(progress).toEqual([30, 100]);
    const [url, init] = seen[0];
    expect(url).toBe('http://conv/convert?projectGUID=p&modelGUID=m&granularity=group&skipEmpty=0&startDate=2026-11-23');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer TOKEN', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ url: 'https://x/y.ifc' });
    expect(seen[1][1].headers.Authorization).toBe('Bearer TOKEN');
  });

  it('a file source: the bytes as they are, the file name becomes sourceName', async () => {
    const fetchFn: any = jest.fn(async (url: string) => (url.includes('/convert') ? resp({ jobId: 'J' }, true, 202) : resp({ state: 'done', progress: 100, result: {} })));
    const bytes = new Uint8Array([1, 2, 3]);
    await convertOnServer(cfg, params, { kind: 'bytes', bytes, name: 'my model.ifc' }, undefined, fetchFn, 1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain('sourceName=my+model.ifc');
    expect(init.body).toBe(bytes);
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
  });

  it('no token = a development server without login (no Authorization header)', async () => {
    const fetchFn: any = jest.fn(async (url: string) => (url.includes('/convert') ? resp({ jobId: 'J' }) : resp({ state: 'done', result: {} })));
    await convertOnServer({ baseUrl: 'http://conv', getToken: async () => null }, params, { kind: 'url', url: 'https://x' }, undefined, fetchFn, 1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('the server says no / the job fails / the server is not there / not set up', async () => {
    await expect(convertOnServer(cfg, params, { kind: 'url', url: 'https://x' }, undefined, (async () => resp({ error: 'This host is not allowed.' }, false, 400)) as any, 1)).rejects.toThrow('This host is not allowed.');
    const failing: any = async (url: string) => (url.includes('/convert') ? resp({ jobId: 'J' }) : resp({ state: 'failed', error: 'The IFC has no element with geometry.' }));
    await expect(convertOnServer(cfg, params, { kind: 'url', url: 'https://x' }, undefined, failing, 1)).rejects.toThrow('no element with geometry');
    await expect(convertOnServer(cfg, params, { kind: 'url', url: 'https://x' }, undefined, (async () => { throw new Error('ECONNREFUSED'); }) as any, 1)).rejects.toThrow(/cannot be reached/);
    await expect(convertOnServer({ ...cfg, baseUrl: '' }, params, { kind: 'url', url: 'https://x' })).rejects.toBeInstanceOf(BimServerError);
  });

  it('a job that never ends is given up', async () => {
    const forever: any = async (url: string) => (url.includes('/convert') ? resp({ jobId: 'J' }) : resp({ state: 'running', progress: 5 }));
    await expect(convertOnServer(cfg, params, { kind: 'url', url: 'https://x' }, undefined, forever, 1, 20)).rejects.toThrow(/too long/);
  });

  it('the query has only what was given', () => {
    expect(convertQuery({ projectGUID: 'a', modelGUID: 'b' })).toBe('projectGUID=a&modelGUID=b');
  });

  it('bimServerUrl reads .env (without a trailing slash)', () => {
    process.env.EXPO_PUBLIC_BIM_SERVER_URL = 'http://localhost:8765/';
    expect(bimServerUrl()).toBe('http://localhost:8765');
    delete process.env.EXPO_PUBLIC_BIM_SERVER_URL;
    expect(bimServerUrl()).toBe('');
  });
});
