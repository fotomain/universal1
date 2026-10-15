import { buildRecordingPost, defaultRecordingTitle, playableUrisOfPost } from '../../kit8/ui/components/media/mediaPost';

const now = new Date(2026, 9, 15, 14, 3, 9);

describe('buildRecordingPost', () => {
  it('a one-file audio recording', () => {
    const post = buildRecordingPost({ kind: 'audio', segments: [{ uri: 'file:///d/a.m4a', durationSec: 12.34, hasAudio: true }], ownerGUID: 'user-1', rowGUID: 'row-1', platform: 'ios', now });
    expect(post).toMatchObject({ rowGUID: 'row-1', rowOwnerGUID: 'user-1', rowParentGUID: 'empty', orderInList: now.getTime() });
    expect(post.rowJSON).toMatchObject({
      mediaPostTitle: 'Audio 2026-10-15 14:03',
      mediaPostOrigin: 'file:///d/a.m4a',
      mediaPostMIME: 'audio/mp4',
      mediaPostOriginType: 'file',
      mediaKind: 'audio',
      mediaDurationSec: 12.3,
      mediaWithAudio: true,
      mediaPlatform: 'ios',
    });
    expect(post.rowJSON.mediaSegments).toBeUndefined();
  });

  it('a video cut in parts keeps every part and the total time; sound = any part with sound', () => {
    const post = buildRecordingPost({
      kind: 'video',
      segments: [
        { uri: 'file:///d/1.mp4', durationSec: 4, hasAudio: false },
        { uri: 'file:///d/2.mp4', durationSec: 6.5, hasAudio: true },
      ],
      ownerGUID: '',
      rowGUID: 'row-2',
      platform: 'android',
      title: '  My trip ',
      now,
    });
    expect(post.rowOwnerGUID).toBe('anon');
    expect(post.rowJSON.mediaPostTitle).toBe('My trip');
    expect(post.rowJSON.mediaDurationSec).toBe(10.5);
    expect(post.rowJSON.mediaWithAudio).toBe(true);
    expect(post.rowJSON.mediaSegments).toHaveLength(2);
    expect(playableUrisOfPost(post.rowJSON)).toEqual(['file:///d/1.mp4', 'file:///d/2.mp4']);
  });

  it('a video without sound is flagged so', () => {
    const post = buildRecordingPost({ kind: 'video', segments: [{ uri: 'blob:x', durationSec: 1, hasAudio: false }], ownerGUID: 'u', rowGUID: 'r', platform: 'web', now });
    expect(post.rowJSON.mediaWithAudio).toBe(false);
  });

  it('needs a file', () => {
    expect(() => buildRecordingPost({ kind: 'audio', segments: [], ownerGUID: 'u', rowGUID: 'r', platform: 'web' })).toThrow('at least one file');
  });

  it('default titles', () => {
    expect(defaultRecordingTitle('video', new Date(2026, 0, 2, 3, 4))).toBe('Video 2026-01-02 03:04');
  });

  it('playableUrisOfPost falls back to the origin, and to nothing', () => {
    expect(playableUrisOfPost({ mediaPostOrigin: 'https://x/y.mp4' })).toEqual(['https://x/y.mp4']);
    expect(playableUrisOfPost({})).toEqual([]);
    expect(playableUrisOfPost(null)).toEqual([]);
  });
});
