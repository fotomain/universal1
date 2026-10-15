// native store: the recording is copied from the cache into <document>/media
const mockCopy = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
let mockExists = true;
jest.mock('expo-file-system', () => {
  class Directory { create(o: any) { mockCreate(o); } get uri() { return 'file:///docs/media'; } }
  class File {
    uri: string;
    constructor(...parts: any[]) { this.uri = parts[0] instanceof Directory ? `${parts[0].uri}/${parts[1]}` : parts[0]; }
    copy(target: any) { mockCopy(this.uri, target.uri); }
    get exists() { return mockExists; }
    delete() { mockDelete(this.uri); }
  }
  return { Directory, File, Paths: { document: 'DOC' } };
});

import { deleteStoredMedia, persistRecording, resolveMediaUri } from '../../kit8/ui/components/media/mediaFileStore';

beforeEach(() => { jest.clearAllMocks(); mockExists = true; });

it('copies the recording into the media folder of the app and returns the new uri', async () => {
  const kept = await persistRecording('file:///cache/Camera/ABC.mov', 'video');
  expect(mockCreate).toHaveBeenCalledWith({ intermediates: true, idempotent: true });
  expect(kept).toMatch(/^file:\/\/\/docs\/media\/kit8video_\d+_[a-z0-9]+\.mov$/);
  expect(mockCopy).toHaveBeenCalledWith('file:///cache/Camera/ABC.mov', kept);
});

it('names an audio file m4a and a video mp4 when the source has no extension', async () => {
  expect(await persistRecording('file:///cache/x', 'audio')).toMatch(/\.m4a$/);
  expect(await persistRecording('file:///cache/y', 'video')).toMatch(/\.mp4$/);
});

it('resolveMediaUri is the same uri on a phone; delete never throws', async () => {
  expect(await resolveMediaUri('file:///docs/media/a.mp4')).toBe('file:///docs/media/a.mp4');
  await deleteStoredMedia('file:///docs/media/a.mp4');
  expect(mockDelete).toHaveBeenCalledWith('file:///docs/media/a.mp4');
  mockExists = false;
  await deleteStoredMedia('file:///docs/media/gone.mp4');
  expect(mockDelete).toHaveBeenCalledTimes(1);
  mockDelete.mockImplementation(() => { throw new Error('locked'); });
  mockExists = true;
  await expect(deleteStoredMedia('file:///docs/media/b.mp4')).resolves.toBeUndefined();
});
