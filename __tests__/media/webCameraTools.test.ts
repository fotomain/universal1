/** @jest-environment jsdom */
// jsdom has no TextEncoder / TextDecoder (every browser has)
const nodeUtil = require('util');
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder || nodeUtil.TextEncoder;
(globalThis as any).TextDecoder = (globalThis as any).TextDecoder || nodeUtil.TextDecoder;

import { createStampedStream } from '../../kit8/ui/components/media/video/stampedStream';
import { filterPixels } from '../../kit8/ui/components/media/photo/applyPhotoFilter.web';
import { filterById, applyMatrixToPixel } from '../../kit8/ui/components/media/photo/photoFilters';
import { rawRecordFromWeb } from '../../kit8/ui/components/media/nfc/nfcReader.web';
import { describeRecord, describeTag } from '../../kit8/ui/components/media/nfc/nfcModel';

describe('digital zoom of the web recording (stampedStream)', () => {
  const setup = () => {
    const calls: any[][] = [];
    const ctx: any = { drawImage: (...a: any[]) => calls.push(a), save: jest.fn(), restore: jest.fn(), fillText: jest.fn() };
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') return realCreate(tag);
      return { width: 0, height: 0, getContext: () => ctx, captureStream: () => ({ getVideoTracks: () => [{ stop: jest.fn() }], addTrack: jest.fn() }) } as any;
    }) as any);
    const video: any = { videoWidth: 1280, videoHeight: 720 };
    const source: any = { getVideoTracks: () => [{ getSettings: () => ({ width: 1280, height: 720 }) }], getAudioTracks: () => [] };
    return { calls, video, source };
  };
  afterEach(() => jest.restoreAllMocks());

  it('no zoom: the whole picture; zoom 2: the middle quarter of the picture over the whole canvas - read for EVERY frame', () => {
    const { calls, video, source } = setup();
    let zoom = 1;
    const s = createStampedStream(video, source, null, undefined, () => zoom);
    expect(calls.at(-1)).toEqual([video, 0, 0, 1280, 720]);
    zoom = 2;
    // the next frame (the timer draws when the browser has no frame callback)
    jest.useFakeTimers();
    s.stop();
    jest.useRealTimers();
    const s2 = createStampedStream(video, source, null, undefined, () => zoom);
    expect(calls.at(-1)).toEqual([video, 320, 180, 640, 360, 0, 0, 1280, 720]);
    s2.stop();
  });
  it('no text when the position is null', () => {
    const { video, source } = setup();
    const s = createStampedStream(video, source, null);
    s.stop();
    expect(document.createElement).toHaveBeenCalled();
  });
});

describe('browser photo look', () => {
  it('filterPixels = the matrix, pixel by pixel (the same numbers as the phone)', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 10, 200, 90, 128]);
    const mono = filterById('mono').matrix;
    const expected = [applyMatrixToPixel(mono, 255, 0, 0), applyMatrixToPixel(mono, 10, 200, 90)];
    filterPixels(px, mono);
    expect(Array.from(px.slice(0, 3))).toEqual(expected[0].map((v) => Math.round(v)).map((v, i) => px[i]));
    expect(Math.abs(px[0] - expected[0][0])).toBeLessThanOrEqual(1);
    expect(Math.abs(px[4] - expected[1][0])).toBeLessThanOrEqual(1);
    expect(px[3]).toBe(255); // the alpha stays
    expect(px[7]).toBe(128);
    expect(Math.abs(px[0] - px[1])).toBeLessThanOrEqual(1); // grey
  });
});

describe('Web NFC records become the records of the model', () => {
  const view = (s: string) => new DataView(new TextEncoder().encode(s).buffer);
  it('text, url, mime, empty', () => {
    expect(describeRecord(rawRecordFromWeb({ recordType: 'text', data: view('hello'), lang: 'de' }))).toMatchObject({ kind: 'text', text: 'hello', lang: 'de' });
    expect(describeRecord(rawRecordFromWeb({ recordType: 'url', data: view('https://a.b/c') }))).toMatchObject({ kind: 'uri', openUrl: 'https://a.b/c' });
    expect(describeRecord(rawRecordFromWeb({ recordType: 'mime', mediaType: 'text/plain', data: view('note') }))).toMatchObject({ kind: 'mime', text: 'note' });
    expect(describeRecord(rawRecordFromWeb({ recordType: 'empty' })).kind).toBe('empty');
    expect(describeRecord(rawRecordFromWeb({ recordType: 'absolute-url', data: view('https://x.y') }))).toMatchObject({ kind: 'uri', openUrl: 'https://x.y' });
    expect(describeRecord(rawRecordFromWeb({ recordType: 'example.com:thing', data: view('abc') })).kind).toBe('external');
  });
  it('a whole tag of the browser', () => {
    const tag = { id: '04:a1:b2', techTypes: ['Ndef'], ndefMessage: [rawRecordFromWeb({ recordType: 'url', data: view('https://a.b') })] };
    expect(describeTag(tag)).toMatchObject({ id: '04A1B2', openUrl: 'https://a.b', summary: 'Link · https://a.b' });
  });
});
