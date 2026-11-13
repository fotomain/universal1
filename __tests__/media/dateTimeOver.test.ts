// The date and time over a video: text, place, clock time of a second of a part (documentation/CAMERA_DATE_TIME.html)
import { clockTimeAt, dateTimeOverLayout, dateTimeOverOfPost, dateTimeOverTextAt, formatDateTimeOver, parseDateTimeOverParam, PartClock } from '../../kit8/ui/components/media/dateTimeOver';
import { buildRecordingPost } from '../../kit8/ui/components/media/mediaPost';
import { buildPlayRoute } from '../../kit8/ui/components/media/mediaSource';

const local = (y: number, mo: number, d: number, h: number, mi: number, s: number, ms = 0) => new Date(y, mo - 1, d, h, mi, s, ms);

it('the text: YYYY-MM-DD HH:mm:ss, local time, 24 hours, padded', () => {
  expect(formatDateTimeOver(local(2026, 11, 12, 14, 3, 27))).toBe('2026-11-12 14:03:27');
  expect(formatDateTimeOver(local(2027, 1, 2, 0, 0, 5))).toBe('2027-01-02 00:00:05');
});

it('the place: 4 % of the short side, 3 % / 4 % margins, the corner', () => {
  expect(dateTimeOverLayout(1280, 720, 'bottomRight')).toEqual({ fontSize: 29, marginX: 38, marginY: 29, right: true, bottom: true });
  expect(dateTimeOverLayout(1280, 720, 'topLeft')).toMatchObject({ right: false, bottom: false });
  expect(dateTimeOverLayout(1280, 720, 'topRight')).toMatchObject({ right: true, bottom: false });
  expect(dateTimeOverLayout(1280, 720, 'bottomLeft')).toMatchObject({ right: false, bottom: true });
  // portrait: the short side is the width
  expect(dateTimeOverLayout(720, 1280, 'topLeft')).toMatchObject({ fontSize: 29, marginX: 22, marginY: 51 });
  // a small box never gets an unreadable text; nonsense sizes do not throw
  expect(dateTimeOverLayout(200, 100, 'topLeft').fontSize).toBe(10);
  expect(dateTimeOverLayout(0, -5, 'topLeft')).toMatchObject({ fontSize: 10, marginX: 0, marginY: 0 });
});

describe('the clock time of a second of a part', () => {
  const start = local(2026, 11, 12, 14, 3, 15);
  const part = { startedAt: start.toISOString(), pauses: [{ atSec: 12, lengthSec: 20 }] };

  it('the sample of the design document: second 30 after a pause of 20 s at second 12', () => {
    expect(formatDateTimeOver(clockTimeAt(part, 30)!)).toBe('2026-11-12 14:04:05');
  });
  it('before the pause the clock runs with the video; at the pause it jumps', () => {
    expect(formatDateTimeOver(clockTimeAt(part, 0)!)).toBe('2026-11-12 14:03:15');
    expect(formatDateTimeOver(clockTimeAt(part, 11.9)!)).toBe('2026-11-12 14:03:26');
    expect(formatDateTimeOver(clockTimeAt(part, 12)!)).toBe('2026-11-12 14:03:47');
  });
  it('no pauses, bad values', () => {
    expect(formatDateTimeOver(clockTimeAt({ startedAt: start.toISOString() }, 5)!)).toBe('2026-11-12 14:03:20');
    expect(formatDateTimeOver(clockTimeAt(part, NaN)!)).toBe('2026-11-12 14:03:15');
    expect(clockTimeAt({ startedAt: 'not a date' }, 5)).toBeNull();
  });
});

it('PartClock: start, pause, resume -> the part of the post', () => {
  const t0 = local(2026, 11, 12, 14, 3, 15).getTime();
  const c = new PartClock(t0);
  expect(c.toPart()).toEqual({ startedAt: new Date(t0).toISOString() });
  c.pause(t0 + 12000);
  c.pause(t0 + 13000); // a second pause while paused changes nothing
  c.resume(t0 + 32000);
  c.resume(t0 + 33000); // not paused: nothing
  c.pause(t0 + 42000); // 22 s of video recorded so far
  c.resume(t0 + 43500);
  expect(c.toPart()).toEqual({ startedAt: new Date(t0).toISOString(), pauses: [{ atSec: 12, lengthSec: 20 }, { atSec: 22, lengthSec: 1.5 }] });
  // second 25 of the file = 25 s + both pauses after the start
  expect(clockTimeAt(c.toPart(), 25)!.getTime()).toBe(t0 + 25000 + 21500);
});

describe('the media post', () => {
  const base = { kind: 'video' as const, ownerGUID: 'u', rowGUID: 'g', platform: 'android', now: local(2026, 11, 12, 15, 0, 0) };
  const s1 = { uri: 'file:///a1.mp4', durationSec: 40, hasAudio: true, startedAt: '2026-11-12T13:03:15.000Z', pauses: [{ atSec: 12, lengthSec: 20 }] };
  const s2 = { uri: 'file:///a2.mp4', durationSec: 35, hasAudio: false, startedAt: '2026-11-12T13:04:15.700Z' };

  it('without the switch: no stamp key (a post of before), only when it was recorded', () => {
    const json = buildRecordingPost({ ...base, segments: [s1] }).rowJSON;
    expect(json.mediaDateTimeOver).toBeUndefined();
    expect(json.mediaRecordedAt).toBe(s1.startedAt);
    expect(dateTimeOverOfPost(json)).toBeNull();
  });

  it('phone: not in the picture -> the corner + one part per file with its start and pauses', () => {
    const json = buildRecordingPost({ ...base, segments: [s1, s2], dateTimeOver: { position: 'topLeft', burnedIn: false } }).rowJSON;
    expect(json.mediaDateTimeOver).toEqual({
      position: 'topLeft',
      burnedIn: false,
      parts: [{ startedAt: s1.startedAt, pauses: [{ atSec: 12, lengthSec: 20 }] }, { startedAt: s2.startedAt }],
    });
    const over = dateTimeOverOfPost(json)!;
    expect(dateTimeOverTextAt(over, 0, 30)).toBe(formatDateTimeOver(new Date(Date.parse(s1.startedAt) + 50000)));
    expect(dateTimeOverTextAt(over, 1, 0)).toBe(formatDateTimeOver(new Date(s2.startedAt)));
    expect(dateTimeOverTextAt(over, 2, 0)).toBe(''); // no such file
  });

  it('web: in the picture -> no parts, and the player draws nothing', () => {
    const json = buildRecordingPost({ ...base, platform: 'web', segments: [{ uri: 'blob:x', durationSec: 5, hasAudio: true }], dateTimeOver: { position: 'bottomRight', burnedIn: true } }).rowJSON;
    expect(json.mediaDateTimeOver).toEqual({ position: 'bottomRight', burnedIn: true });
    expect(dateTimeOverOfPost(json)).toBeNull();
    expect(dateTimeOverTextAt(json.mediaDateTimeOver, 0, 3)).toBe('');
  });

  it('an audio recording never gets the stamp', () => {
    const json = buildRecordingPost({ ...base, kind: 'audio', segments: [{ uri: 'file:///a.m4a', durationSec: 5, hasAudio: true }], dateTimeOver: { position: 'topLeft', burnedIn: false } }).rowJSON;
    expect(json.mediaDateTimeOver).toBeUndefined();
  });

  it('a wrong corner in a stored post falls back to Bottom Right', () => {
    expect(dateTimeOverOfPost({ mediaDateTimeOver: { position: 'x', burnedIn: false, parts: [{ startedAt: s1.startedAt }] } })!.position).toBe('bottomRight');
  });
});

it('the play route carries a stamp that is not in the file, and reads it back', () => {
  const over = { position: 'topLeft', burnedIn: false, parts: [{ startedAt: '2026-11-12T13:03:15.000Z' }] };
  const route = buildPlayRoute('video', { source: 'file:///a.mp4', dateTimeOver: over });
  const stamp = decodeURIComponent(route.split('stamp=')[1]);
  expect(parseDateTimeOverParam(stamp)).toEqual(over);
  expect(buildPlayRoute('video', { source: 'file:///a.mp4', dateTimeOver: { burnedIn: true } })).not.toContain('stamp=');
  expect(parseDateTimeOverParam('not json')).toBeNull();
  expect(parseDateTimeOverParam(undefined)).toBeNull();
});
