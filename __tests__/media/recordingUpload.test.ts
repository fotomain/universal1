// The files of a recording -> the file storage: names, the all-or-nothing upload, the retry while the post is not yet in the database, the rowJSON the post gets.
import { driveFilesOfPost, driveRefOfFileRow, recordingDriveFailed, recordingDriveUploaded, recordingFileName, recordingPath, uploadRecordingFiles } from '../../kit8/files/common/recordingUpload';
import { buildRecordingPost } from '../../kit8/ui/components/media/common/mediaPost';
import { buildPhotoPost } from '../../kit8/ui/components/media/common/notePost';
import { mediaPostRows } from '../../kit8/ui/components/media/common/mediaPostList';
import { readRecordingBlob } from '../../kit8/ui/components/media/common/recordingBlob';

const POST = '12345678-1234-4234-8234-1234567890ab';
const row = (id: string) => ({ rowGUID: `file-${id}`, rowOwnerGUID: 'org', rowParentGUID: POST, orderInList: 1, rowJSON: { mediaPostOrigin: `https://drive.google.com/file/d/${id}/view`, googleDriveFileId: id } });
const blob = (type = 'video/mp4') => new Blob(['abc'], { type });
const files = (n: number) => Array.from({ length: n }, (_, i) => ({ uri: `file:///kit8video_${i}.mp4`, ext: 'mp4', fallbackMime: 'video/mp4' }));

it('names the files by the post: the first plain, the next parts numbered; the folder words', () => {
  expect(recordingFileName(POST, 0, 'MP4')).toBe(`${POST}.mp4`);
  expect(recordingFileName(POST, 1, 'mp4')).toBe(`${POST}-2.mp4`);
  expect(recordingPath('video')).toBe('media/video');
});

it('uploads every part into the scope recording and returns the address of each file', async () => {
  const upload = jest.fn(async (_t: any, f: any) => ({ ok: true as const, file: row(f.name.includes('-2') ? 'B' : 'A') }));
  const r = await uploadRecordingFiles(POST, files(2), { readBlob: async () => blob(), upload: upload as any });
  expect(r.ok).toBe(true);
  expect(upload.mock.calls.map((c: any[]) => [c[0], c[1].name, c[1].mime])).toEqual([
    [{ scope: 'recording', guid: POST }, `${POST}.mp4`, 'video/mp4'],
    [{ scope: 'recording', guid: POST }, `${POST}-2.mp4`, 'video/mp4'],
  ]);
  expect((r as any).refs).toEqual([{ fileRowGUID: 'file-A', googleDriveURLToFile: 'https://drive.google.com/file/d/A/view' }, { fileRowGUID: 'file-B', googleDriveURLToFile: 'https://drive.google.com/file/d/B/view' }]);
});

it('takes the type of the file itself and drops the codecs part', async () => {
  const upload = jest.fn(async () => ({ ok: true as const, file: row('A') }));
  await uploadRecordingFiles(POST, files(1), { readBlob: async () => blob('video/webm;codecs=vp9'), upload: upload as any });
  expect((upload.mock.calls[0] as any[])[1].mime).toBe('video/webm');
});

it('all or nothing: when part 2 fails, part 1 is removed again and the error is returned', async () => {
  const upload = jest.fn(async (_t: any, f: any) => (f.name.includes('-2') ? { ok: false as const, error: 'No storage', code: 'notConnected' } : { ok: true as const, file: row('A') }));
  const remove = jest.fn(async () => ({ ok: true as const, data: {} }));
  const r = await uploadRecordingFiles(POST, files(2), { readBlob: async () => blob(), upload: upload as any, remove: remove as any });
  expect(r).toMatchObject({ ok: false, error: 'No storage' });
  expect(remove).toHaveBeenCalledWith('file-A');
});

it('the first upload is tried again while the post is not yet in the database (reason scope); another error is not', async () => {
  const sleep = jest.fn(async () => undefined);
  let n = 0;
  const upload = jest.fn(async () => (++n < 3 ? { ok: false as const, error: 'scope', code: 'scope' } : { ok: true as const, file: row('A') }));
  const r = await uploadRecordingFiles(POST, files(1), { readBlob: async () => blob(), upload: upload as any, sleep });
  expect(r.ok).toBe(true);
  expect(upload).toHaveBeenCalledTimes(3);
  const upload2 = jest.fn(async () => ({ ok: false as const, error: 'The storage limit', code: 'storageLimit' }));
  const r2 = await uploadRecordingFiles(POST, files(1), { readBlob: async () => blob(), upload: upload2 as any, sleep });
  expect(r2.ok).toBe(false);
  expect(upload2).toHaveBeenCalledTimes(1);
});

it('a file that cannot be read is an error, nothing is uploaded', async () => {
  const upload = jest.fn();
  const r = await uploadRecordingFiles(POST, files(1), { readBlob: async () => { throw new Error('gone'); }, upload: upload as any });
  expect(r).toMatchObject({ ok: false, error: 'gone' });
  expect(upload).not.toHaveBeenCalled();
  expect(await uploadRecordingFiles(POST, [], { readBlob: async () => blob() })).toMatchObject({ ok: false });
});

it('the post keeps googleDriveURLToFile and the files; a failure keeps the reason and the local file', () => {
  const refs = [driveRefOfFileRow(row('A')), driveRefOfFileRow(row('B'))];
  const ok = recordingDriveUploaded({ mediaPostTitle: 'V', mediaDriveError: 'old' }, refs);
  expect(ok).toMatchObject({ googleDriveURLToFile: 'https://drive.google.com/file/d/A/view', mediaDriveState: 'uploaded' });
  expect(ok.mediaDriveError).toBeUndefined();
  expect(driveFilesOfPost(ok)).toEqual(refs);
  const bad = recordingDriveFailed({ mediaPostTitle: 'V', mediaPostOrigin: 'file:///a.mp4' }, 'Google Drive is not connected.');
  expect(bad).toMatchObject({ mediaDriveState: 'failed', mediaDriveError: 'Google Drive is not connected.', mediaPostOrigin: 'file:///a.mp4' });
  expect(driveFilesOfPost(bad)).toEqual([]);
  expect(driveFilesOfPost(null)).toEqual([]);
});

it('a recording post and a photo post name their folder in the storage', () => {
  const seg = { uri: 'file:///a.mp4', durationSec: 3, hasAudio: true };
  expect(buildRecordingPost({ kind: 'video', segments: [seg], ownerGUID: 'u', rowGUID: POST, platform: 'ios' }).rowJSON.recordingFolder).toBe('video');
  expect(buildRecordingPost({ kind: 'audio', segments: [seg], ownerGUID: 'u', rowGUID: POST, platform: 'ios' }).rowJSON.recordingFolder).toBe('audio');
  expect(buildPhotoPost({ ownerGUID: 'u', rowGUID: POST, platform: 'ios', uri: 'file:///a.jpg', filterId: 'original', filterLabel: 'Original' } as any).rowJSON.recordingFolder).toBe('photo');
});

it('the list: the file rows of a recording are not cards; the drive files of a post go to the player', () => {
  const rows = mediaPostRows([
    { rowGUID: POST, rowJSON: { mediaKind: 'video', mediaPostOrigin: 'file:///a.mp4', mediaDriveFiles: [{ fileRowGUID: 'file-A', googleDriveURLToFile: 'u' }] } },
    { rowGUID: 'file-A', rowJSON: { fileSourceKind: 'recording', mediaPostTitle: 'x.mp4' } },
  ]);
  expect(rows).toHaveLength(1);
  expect(rows[0].driveFiles).toEqual([{ fileRowGUID: 'file-A', googleDriveURLToFile: 'u' }]);
});

it('readRecordingBlob resolves the stored address, reads it and refuses an empty file', async () => {
  const resolve = jest.fn(async () => 'blob:http://x/1');
  const fetchFn = jest.fn(async () => ({ blob: async () => blob() })) as any;
  expect((await readRecordingBlob('kit8media://a.webm', fetchFn, resolve)).size).toBe(3);
  expect(fetchFn).toHaveBeenCalledWith('blob:http://x/1');
  await expect(readRecordingBlob('x', (async () => ({ blob: async () => new Blob([]) })) as any, resolve)).rejects.toThrow('empty');
});
