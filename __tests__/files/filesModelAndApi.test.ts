/** @jest-environment node */
// The pure model of the file attachments and the app side of the upload (kit8/files): kinds, sizes, chunks, the answer of the function, and the whole upload flow with a fake function and a fake Google.
import { chunkRanges, driveStateText, FILE_KIND_ICON, filterFilesByName, fileKindOf, fileTitleOf, filesEnabledOfProject, filesErrorText, formatBytes, isLinkRow, MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES, type FileRow } from '../../kit8/files/fileModel';
import { functionResultOf, moveFile, replacePickedFile, repairHealth, runHealthCheck, uploadPickedFile } from '../../kit8/files/filesDriveApi';

const mockInvoke = jest.fn();
jest.mock('../../kit8/supabase/supabase', () => ({ supabase: { functions: { invoke: (...a: any[]) => mockInvoke(...a) } } }), { virtual: true });

describe('the search of the Files panel (filterFilesByName)', () => {
  const row = (guid: string, json: any): FileRow => ({ rowGUID: guid, rowOwnerGUID: 'o', rowParentGUID: 'p', orderInList: 1, rowJSON: json });
  const rows = [
    row('a', { mediaPostTitle: 'Plan of the Hall.pdf', fileName: 'scan0001.pdf', googleDriveFileId: 'D1' }),
    row('b', { fileName: 'Photo_2026.JPG', googleDriveFileId: 'D2' }),
    row('c', { mediaPostTitle: 'Video', mediaPostOriginType: 'url', mediaPostOrigin: 'https://youtu.be/abc' }),
    row('d', { mediaPostOriginType: 'url', mediaPostOrigin: 'https://example.com/Spec' }),
  ];
  const guids = (q: string | null | undefined) => filterFilesByName(rows, q).map((r) => r.rowGUID);
  it('an empty or blank query keeps every row, in the same order (and never the same array)', () => {
    expect(guids('')).toEqual(['a', 'b', 'c', 'd']);
    expect(guids('   ')).toEqual(['a', 'b', 'c', 'd']);
    expect(guids(undefined)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterFilesByName(rows, '')).not.toBe(rows);
  });
  it('a case-insensitive substring of the name the user sees', () => {
    expect(guids('plan')).toEqual(['a']);
    expect(guids('HALL')).toEqual(['a']);
    expect(guids('  photo ')).toEqual(['b']);
    expect(guids('.pdf')).toEqual(['a']);
  });
  it('a renamed file is also found by its original file name', () => {
    expect(guids('scan0001')).toEqual(['a']);
  });
  it('links: by the title, and by the address while the link has no title', () => {
    expect(guids('video')).toEqual(['c']);
    expect(guids('spec')).toEqual(['d']);
    expect(guids('youtu')).toEqual([]);
  });
  it('nothing matches = an empty list', () => {
    expect(guids('zzz')).toEqual([]);
  });
});

describe('the model', () => {
  it('the project switch is TRUE unless it is stored false', () => {
    expect(filesEnabledOfProject(undefined)).toBe(true);
    expect(filesEnabledOfProject({})).toBe(true);
    expect(filesEnabledOfProject({ filesFunctionalityEnabled: true })).toBe(true);
    expect(filesEnabledOfProject({ filesFunctionalityEnabled: false })).toBe(false);
  });
  it('the kind of a file by MIME type and name (the same rule as the SQL files_kind_of)', () => {
    expect(fileKindOf('application/pdf', 'x')).toBe('pdf');
    expect(fileKindOf('', 'SCAN.PDF')).toBe('pdf');
    expect(fileKindOf('text/plain', 'notes.md')).toBe('markdown');
    expect(fileKindOf('text/plain', 'a.txt')).toBe('text');
    expect(fileKindOf('', 'data.csv')).toBe('text');
    expect(fileKindOf('image/png', 'a.png')).toBe('image');
    expect(fileKindOf('audio/mpeg', 'a.mp3')).toBe('audio');
    expect(fileKindOf('video/mp4', 'a.mp4')).toBe('video');
    expect(fileKindOf('application/zip', 'a.zip')).toBe('other');
    for (const k of ['text', 'markdown', 'audio', 'video', 'pdf', 'image', 'other'] as const) expect(FILE_KIND_ICON[k]).toBeTruthy();
  });
  it('sizes for people', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1048576)).toBe('5.0 MB');
    expect(formatBytes(150 * 1048576)).toBe('150 MB');
    expect(formatBytes(3 * 1073741824)).toBe('3.0 GB');
  });
  it('a file is cut into chunks of 256 KB multiples with a Content-Range each, the last one shorter', () => {
    expect(UPLOAD_CHUNK_BYTES % 262144).toBe(0);
    const r = chunkRanges(10_000_000);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ start: 0, end: 4194304, contentRange: 'bytes 0-4194303/10000000' });
    expect(r[2]).toEqual({ start: 8388608, end: 10_000_000, contentRange: 'bytes 8388608-9999999/10000000' });
    expect(chunkRanges(1)).toEqual([{ start: 0, end: 1, contentRange: 'bytes 0-0/1' }]);
    expect(chunkRanges(0)).toEqual([]);
  });
  it('titles, link rows, the state words and the sentences of a refusal', () => {
    const row = (j: any): FileRow => ({ rowGUID: 'g', rowOwnerGUID: 'o', rowParentGUID: 'p', orderInList: 1, rowJSON: j });
    expect(fileTitleOf(row({ mediaPostTitle: 'T', fileName: 'f.pdf' }))).toBe('T');
    expect(fileTitleOf(row({ fileName: 'f.pdf' }))).toBe('f.pdf');
    expect(isLinkRow(row({ mediaPostOriginType: 'url', mediaPostOrigin: 'https://x.test' }))).toBe(true);
    expect(isLinkRow(row({ mediaPostOriginType: 'googleDrive', googleDriveFileId: 'F' }))).toBe(false);
    expect(driveStateText('ok', 'a@b.c')).toBe('Google Drive: connected as a@b.c');
    expect(driveStateText('needsReconnect')).toMatch(/reconnect/);
    expect(driveStateText(undefined)).toMatch(/not connected/);
    expect(filesErrorText('noPermission')).toMatch(/no permission/i);
    expect(filesErrorText('weird', 'fallback')).toBe('fallback');
  });
});

describe('the answer of the function', () => {
  it('data without an error is ok; an error in data or a refusal with a JSON body becomes a sentence and a code', async () => {
    expect(await functionResultOf({ data: { a: 1 } })).toEqual({ ok: true, data: { a: 1 } });
    expect(await functionResultOf({ data: { error: 'x', code: 'notConnected' } })).toMatchObject({ ok: false, code: 'notConnected', error: expect.stringMatching(/not connected/) });
    const refusal = await functionResultOf({ error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'No permission (noPermission).', reason: 'noPermission' }) } } });
    expect(refusal).toMatchObject({ ok: false, code: 'noPermission', error: expect.stringMatching(/no permission/i) });
    expect(await functionResultOf(null)).toMatchObject({ ok: false });
    expect(await functionResultOf({ error: { message: 'boom' } })).toMatchObject({ ok: false, error: 'boom' });
  });
});

describe('uploadPickedFile: session -> chunks to Google -> finish', () => {
  const blobOf = (n: number) => new Blob([new Uint8Array(n)]);
  const pick = (n: number) => ({ name: 'plan.pdf', mime: 'application/pdf', size: n, blob: blobOf(n) });
  const target = { scope: 'task' as const, guid: 'T1', projectGUID: 'P1' };
  beforeEach(() => mockInvoke.mockReset());

  it('opens the session, sends every chunk with its Content-Range and no Authorization, then finishes by the uploadId', async () => {
    mockInvoke.mockImplementation(async (_fn: string, { body }: any) => {
      if (body.action === 'upload_session') return { data: { sessionUrl: 'https://google.test/session/1', uploadId: 'up-1' }, error: null };
      if (body.action === 'upload_finish') return { data: { file: { rowGUID: 'post1', rowJSON: { fileName: 'plan.pdf' } } }, error: null };
      return { data: null, error: { message: 'unexpected' } };
    });
    const puts: { url: string; range: string; auth: any; size: number }[] = [];
    const fetchFn = jest.fn(async (url: string, init: any) => { puts.push({ url, range: init.headers['Content-Range'], auth: init.headers.Authorization, size: init.body.size }); return new Response(null, { status: init.headers['Content-Range'].endsWith('/6000000') && init.headers['Content-Range'].startsWith('bytes 4194304') ? 200 : 308 }); });
    const progress: number[] = [];
    const r = await uploadPickedFile(target, pick(6_000_000), { onProgress: (f) => progress.push(f) }, fetchFn as any);
    expect(r).toMatchObject({ ok: true, file: { rowGUID: 'post1' } });
    expect(puts.map((p) => p.range)).toEqual(['bytes 0-4194303/6000000', 'bytes 4194304-5999999/6000000']);
    expect(puts.every((p) => p.url === 'https://google.test/session/1' && p.auth === undefined)).toBe(true);
    expect(puts.map((p) => p.size)).toEqual([4194304, 1805696]);
    expect(progress[progress.length - 1]).toBe(1);
    const calls = mockInvoke.mock.calls.map((c) => c[1].body);
    expect(calls[0]).toMatchObject({ action: 'upload_session', scope: 'task', guid: 'T1', projectGUID: 'P1', name: 'plan.pdf', mime: 'application/pdf', size: 6_000_000 });
    expect(calls[1]).toMatchObject({ action: 'upload_finish', uploadId: 'up-1', file: { title: 'plan.pdf', kind: 'pdf' } });
  });
  it('a browser that cannot read the answer of the last chunk (TypeError) still finishes by the uploadId; finish waits for a file that is not there yet', async () => {
    let finishCalls = 0;
    mockInvoke.mockImplementation(async (_fn: string, { body }: any) => {
      if (body.action === 'upload_session') return { data: { sessionUrl: 'https://google.test/s', uploadId: 'up-2' }, error: null };
      finishCalls++;
      return finishCalls < 2 ? { data: { error: 'not yet', code: 'notFinished' }, error: null } : { data: { file: { rowGUID: 'post2' } }, error: null };
    });
    jest.useFakeTimers();
    const fetchFn = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    const p = uploadPickedFile(target, pick(1000), {}, fetchFn as any);
    await jest.advanceTimersByTimeAsync(2000);
    const r = await p;
    jest.useRealTimers();
    expect(r).toMatchObject({ ok: true, file: { rowGUID: 'post2' } });
    expect(finishCalls).toBe(2);
  });
  it('stops at a refusal of Google, a cancel, an empty file, a file over 100 MB and a refused session', async () => {
    mockInvoke.mockResolvedValue({ data: { sessionUrl: 'https://google.test/s', uploadId: 'up-3' }, error: null });
    expect(await uploadPickedFile(target, pick(1000), {}, (async () => new Response(null, { status: 403 })) as any)).toMatchObject({ ok: false, error: expect.stringContaining('403') });
    expect(await uploadPickedFile(target, pick(1000), { signal: { aborted: true } }, (async () => new Response(null, { status: 308 })) as any)).toMatchObject({ ok: false, error: 'Cancelled.' });
    expect(await uploadPickedFile(target, pick(0))).toMatchObject({ ok: false, error: 'The file is empty.' });
    expect(await uploadPickedFile(target, { ...pick(10), size: MAX_UPLOAD_BYTES + 1 })).toMatchObject({ ok: false, error: expect.stringContaining('100 MB') });
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'Google Drive is not connected.', code: 'notConnected' }) } } });
    expect(await uploadPickedFile(target, pick(10))).toMatchObject({ ok: false, code: 'notConnected' });
  });
});

describe('replace (S4), move (S7) and the health check (S1)', () => {
  const row = { rowGUID: 'post1', rowOwnerGUID: 'o', rowParentGUID: 'T1', orderInList: 1, rowJSON: { fileName: 'plan.pdf' } } as unknown as FileRow;
  const pick = (n: number) => ({ name: 'plan2.pdf', mime: 'application/pdf', size: n, blob: new Blob([new Uint8Array(n)]) });
  beforeEach(() => mockInvoke.mockReset());

  it('replace: an update session of the SAME file, chunks, finish by the uploadId', async () => {
    mockInvoke.mockImplementation(async (_fn: string, { body }: any) => {
      if (body.action === 'replace_session') return { data: { sessionUrl: 'https://google.test/upd', uploadId: 'up-9' }, error: null };
      if (body.action === 'replace_finish') return { data: { file: { rowGUID: 'post1', rowJSON: { fileVersionNumber: 2 } } }, error: null };
      return { data: null, error: { message: 'unexpected' } };
    });
    const fetchFn = jest.fn(async () => new Response(null, { status: 200 }));
    const r = await replacePickedFile(row, pick(1000), {}, fetchFn as any);
    expect(r).toMatchObject({ ok: true, file: { rowJSON: { fileVersionNumber: 2 } } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls.map((c) => c[1].body)).toEqual([
      { action: 'replace_session', postGUID: 'post1', name: 'plan2.pdf', mime: 'application/pdf', size: 1000 },
      { action: 'replace_finish', uploadId: 'up-9' },
    ]);
  });
  it('replace refuses an empty or too big file and passes on the refusal of the function', async () => {
    expect(await replacePickedFile(row, pick(0))).toMatchObject({ ok: false, error: 'The file is empty.' });
    expect(await replacePickedFile(row, { ...pick(10), size: MAX_UPLOAD_BYTES + 1 })).toMatchObject({ ok: false, error: expect.stringContaining('100 MB') });
    mockInvoke.mockResolvedValue({ data: { error: 'full', code: 'storageLimit' }, error: null });
    expect(await replacePickedFile(row, pick(10))).toMatchObject({ ok: false, code: 'storageLimit' });
  });
  it('move, health and repair call the function with their arguments', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: 1 }, error: null });
    await moveFile('post1', { scope: 'project', guid: 'P1', projectGUID: 'P1' });
    await runHealthCheck();
    await repairHealth(['m1'], ['o1']);
    expect(mockInvoke.mock.calls.map((c) => c[1].body)).toEqual([
      { action: 'move', postGUID: 'post1', scope: 'project', guid: 'P1', projectGUID: 'P1' },
      { action: 'health' },
      { action: 'health_repair', missing: ['m1'], orphans: ['o1'] },
    ]);
  });
});
