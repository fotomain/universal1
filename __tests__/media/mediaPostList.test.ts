// The rows of the phone's Media Posts list
import { mediaPostRows } from '../../kit8/ui/components/media/mediaPostList';

const recorded = '2026-11-13T08:33:44.002Z';
const video = {
  rowGUID: 'v1', orderInList: 20,
  rowJSON: {
    mediaPostTitle: 'Video 2026-11-13 10:33', mediaKind: 'video', mediaDurationSec: 34, mediaRecordedAt: recorded,
    mediaPostOrigin: 'file:///a.mp4',
    mediaDateTimeOver: { position: 'topLeft', burnedIn: false, parts: [{ startedAt: recorded }] },
  },
};
const audio = { rowGUID: 'a1', orderInList: 10, rowJSON: { mediaPostTitle: 'Audio', mediaKind: 'audio', mediaDurationSec: 5, mediaPostOrigin: 'file:///a.m4a', mediaCreatedAt: recorded } };
const link = { rowGUID: 'l1', orderInList: 30, rowJSON: { mediaPostTitle: 'A web page', mediaPostOrigin: 'https://example.com' } };

it('newest first; a recording is playable and a link post is not', () => {
  const rows = mediaPostRows([audio, video, link]);
  expect(rows.map((r) => r.id)).toEqual(['l1', 'v1', 'a1']);
  expect(rows[0]).toMatchObject({ kind: '', uris: [], dateTimeOver: null });
  expect(rows[1]).toMatchObject({ kind: 'video', uris: ['file:///a.mp4'] });
  expect(rows[1].subtitle).toMatch(/^Video · 0:34 · \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(rows[1].dateTimeOver).toMatchObject({ position: 'topLeft', burnedIn: false });
  expect(rows[2].subtitle).toMatch(/^Audio · 0:05 · /);
  expect(rows[2].dateTimeOver).toBeNull();
});

it('several files = all of them are played; bad input gives no rows', () => {
  const two = { rowGUID: 's', rowJSON: { mediaKind: 'video', mediaSegments: [{ uri: 'file:///1.mp4' }, { uri: 'file:///2.mp4' }] } };
  expect(mediaPostRows([two])[0].uris).toEqual(['file:///1.mp4', 'file:///2.mp4']);
  expect(mediaPostRows(undefined)).toEqual([]);
  expect(mediaPostRows([{ rowJSON: {} }, null])).toEqual([]);
});

it('a post that is not a recording says what it is and when it was made', () => {
  const photo = { rowGUID: 'p', created_at: '2026-11-10T09:05:00.000Z', rowJSON: { mediaPostTitle: 'photo_1_y.jpg', mediaPostSubTitle: 'photo_1_y.jpg', mediaPostOriginType: 'file' } };
  expect(mediaPostRows([photo])[0].subtitle).toMatch(/^photo_1_y\.jpg · 2026-11-10 \d{2}:\d{2}$/);
});

it('a FILE row (Files tab) is flagged: it cannot be deleted with a plain DELETE', () => {
  const file = { rowGUID: 'f', rowJSON: { mediaPostTitle: 'photo_1_y.jpg', fileSourceKind: 'task' } };
  const own = { rowGUID: 'o', rowJSON: { mediaPostTitle: 'my note' } };
  const rows = mediaPostRows([file, own]);
  expect(rows.find((r) => r.id === 'f')!.isFileRow).toBe(true);
  expect(rows.find((r) => r.id === 'o')!.isFileRow).toBe(false);
});
