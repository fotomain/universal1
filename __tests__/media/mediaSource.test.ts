import {
  buildPlayRoute,
  extensionOf,
  fileNameOf,
  formatDuration,
  mediaKindFromUri,
  mimeTypeOf,
  normalizeQueue,
  parseAutoPlayParam,
  parseMediaSource,
  parseQueueParam,
} from '../../kit8/ui/components/media/mediaSource';

describe('parseMediaSource', () => {
  it('accepts a web address', () => {
    expect(parseMediaSource(' https://example.com/a/b.mp4?x=1 ')).toEqual({ type: 'remote', uri: 'https://example.com/a/b.mp4?x=1', fileName: 'b.mp4' });
    expect(parseMediaSource('http://host/stream.m3u8').type).toBe('remote');
  });
  it('accepts a file of the device, an absolute path (quoted too) and a content uri', () => {
    expect(parseMediaSource('file:///data/a%20b.m4a')).toMatchObject({ type: 'local', fileName: 'a b.m4a' });
    expect(parseMediaSource('"/Users/me/clip.mov"')).toEqual({ type: 'local', uri: 'file:///Users/me/clip.mov', fileName: 'clip.mov' });
    expect(parseMediaSource('content://media/external/video/12').type).toBe('local');
  });
  it('knows blob urls and the recordings stored by the app', () => {
    expect(parseMediaSource('blob:http://localhost/1234').type).toBe('blob');
    expect(parseMediaSource('kit8media://kit8video_1_ab.webm')).toMatchObject({ type: 'stored', fileName: 'kit8video_1_ab.webm' });
  });
  it('refuses everything else', () => {
    for (const bad of ['', '   ', 'hello', 'ftp://x/y.mp4', 'www.example.com/a.mp4', undefined, null]) {
      expect(parseMediaSource(bad as any).type).toBe('invalid');
    }
  });
});

describe('file helpers', () => {
  it('extension, name, kind and mime type', () => {
    expect(extensionOf('https://x.com/dir/Movie.MP4?token=a.b')).toBe('mp4');
    expect(extensionOf('https://x.com/dir/noext')).toBe('');
    expect(fileNameOf('blob:http://x/1')).toBe('');
    expect(mediaKindFromUri('a.m4a')).toBe('audio');
    expect(mediaKindFromUri('a.webm')).toBe('video');
    expect(mediaKindFromUri('a.unknown')).toBeNull();
    expect(mimeTypeOf('a.mp3', 'audio')).toBe('audio/mpeg');
    expect(mimeTypeOf('a.xyz', 'video')).toBe('video/mp4');
    expect(mimeTypeOf('a.xyz', 'audio')).toBe('audio/mp4');
  });
  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(83.9)).toBe('1:23');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(-4)).toBe('0:00');
  });
});

describe('queues and route parameters', () => {
  it('normalizeQueue drops empty and invalid items, keeps the order', () => {
    expect(normalizeQueue(['https://a/1.mp4', '', 'junk', '/tmp/2.mp4'])).toEqual(['https://a/1.mp4', 'file:///tmp/2.mp4']);
    expect(normalizeQueue('https://a/1.mp4')).toEqual(['https://a/1.mp4']);
    expect(normalizeQueue(undefined)).toEqual([]);
  });
  it('parseQueueParam reads one uri or a JSON list', () => {
    expect(parseQueueParam('https://a/1.mp4')).toEqual(['https://a/1.mp4']);
    expect(parseQueueParam(JSON.stringify(['https://a/1.mp4', 'file:///b.mp4']))).toEqual(['https://a/1.mp4', 'file:///b.mp4']);
    expect(parseQueueParam('[broken')).toEqual([]);
    expect(parseQueueParam(undefined)).toEqual([]);
    expect(parseQueueParam(['https://a/1.mp4'])).toEqual(['https://a/1.mp4']);
  });
  it('parseAutoPlayParam plays by default', () => {
    expect(parseAutoPlayParam(undefined)).toBe(true);
    expect(parseAutoPlayParam('true')).toBe(true);
    expect(parseAutoPlayParam('false')).toBe(false);
    expect(parseAutoPlayParam('0')).toBe(false);
    expect(parseAutoPlayParam(false)).toBe(false);
  });
  it('buildPlayRoute round-trips through parseQueueParam', () => {
    expect(buildPlayRoute('audio')).toBe('/media/play/audio');
    const one = buildPlayRoute('video', { source: 'https://a/1.mp4?x=1&y=2', autoPlay: false, title: 'My clip' });
    expect(one).toBe('/media/play/video?url=https%3A%2F%2Fa%2F1.mp4%3Fx%3D1%26y%3D2&autoPlay=false&title=My%20clip');
    const many = buildPlayRoute('video', { source: ['https://a/1.mp4', 'file:///b.mp4'] });
    const url = decodeURIComponent(many.split('url=')[1]);
    expect(parseQueueParam(url)).toEqual(['https://a/1.mp4', 'file:///b.mp4']);
  });
});
