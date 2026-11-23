/** @jest-environment jsdom */
// The post of a PASSPORT whose face image is JPEG 2000 (Latvia): the post gets a JPEG made from it (Android cannot draw JPEG 2000), the ORIGINAL goes to the storage.
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

(globalThis as any).__offerPosts = [] as any[];
jest.mock('../../kit8/ui/components/media/common/useWriteMediaPost', () => ({
  useIsSignedIn: () => true,
  useWriteMediaPost: () => async (build: any) => { const post = build({ ownerGUID: 'u1', rowGUID: 'r1', platform: 'android' }); (globalThis as any).__offerPosts.push(post); return post; },
}));

jest.mock('../../kit8/ui/components/media/nfc/iddocread/idTransport', () => ({ isoDepSupported: () => true, openIsoDep: async () => { throw new Error('no card here'); } }));

import IdCardPostOffer from '../../kit8/ui/components/media/nfc/iddocread/IdCardPostOffer';

const jp2 = new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'face_96x128.jp2')));
const f = (value: string) => ({ value, valid: true });
const doc = (photo: any): any => ({
  mrz: { format: 'TD3', documentCode: 'P', issuingState: 'LVA', surname: 'TERENTJEVS', givenNames: 'JURIJS', documentNumber: f('LV6073206'), nationality: 'LVA', birthDate: f('711002'), sex: 'M', expiryDate: f('290618'), optionalData: '', allValid: true },
  details: null, document: null, photo,
});

afterEach(() => { cleanup(); (globalThis as any).__offerPosts.length = 0; });

it('a JPEG 2000 photo: the post carries a JPEG picture, the storage gets the original bytes', async () => {
  const uploads: any[] = [];
  const upload = (async (guid: string, photo: any) => { uploads.push({ guid, mime: photo.mime, size: photo.bytes.length }); return { ok: true }; }) as any;
  render(<IdCardPostOffer doc={doc({ mime: 'image/jp2', bytes: jp2 })} upload={upload} />);
  await flush();
  await pressAsync('id-post-create');
  const [post] = (globalThis as any).__offerPosts;
  expect(post.rowJSON.mediaImageUri).toMatch(/^data:image\/jpeg;base64,\/9j\//);
  expect(post.rowJSON.mediaPostMIME).toBe('image/jpeg');
  expect(post.rowJSON.mediaPostDescription).not.toContain('cannot draw');
  expect(uploads).toEqual([{ guid: 'r1', mime: 'image/jp2', size: jp2.length }]);
  expect(text('id-post-note')).toContain('Owner photo saved');
});

it('a JPEG 2000 that cannot be read: no picture in the post, the description says it is in the storage, the upload still happens', async () => {
  const uploads: any[] = [];
  const upload = (async (guid: string) => { uploads.push(guid); return { ok: true }; }) as any;
  render(<IdCardPostOffer doc={doc({ mime: 'image/jp2', bytes: new Uint8Array(300).fill(5) })} upload={upload} />);
  await flush();
  await pressAsync('id-post-create');
  const [post] = (globalThis as any).__offerPosts;
  expect(post.rowJSON.mediaImageUri).toBeUndefined();
  expect(post.rowJSON.mediaPostDescription).toContain('Photo: in the file storage');
  expect(uploads).toEqual(['r1']);
  expect(q('id-post-saved')).not.toBeNull();
});

it('after the post is made a screen of its own opens: the owner photo ABOVE the text, then the buttons; Close leaves the line behind', async () => {
  const upload = (async () => ({ ok: true })) as any;
  render(<IdCardPostOffer doc={doc({ mime: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) })} upload={upload} />);
  await flush();
  await pressAsync('id-post-create');
  expect(q('id-post-screen-photo')).not.toBeNull();
  expect(text('id-post-screen-title')).toContain('Media post created.');
  expect(text('id-post-screen-owner')).toContain('JURIJS TERENTJEVS');
  const html = q('id-post-screen')!.innerHTML;
  expect(html.indexOf('id-post-screen-photo')).toBeLessThan(html.indexOf('id-post-screen-title'));
  await pressAsync('id-post-screen-close');
  expect(q('id-post-screen')).toBeNull();
  expect(q('id-post-saved')).not.toBeNull();
});

describe('the reader screen on Android', () => {
  const { Platform } = require('react-native');
  const { DocumentView } = require('../../kit8/ui/components/media/nfc/iddocread/IdCardReader');
  const realOS = Platform.OS;
  beforeEach(() => { Platform.OS = 'android'; });
  afterEach(() => { Platform.OS = realOS; });

  const wait = (ms: number) => require('react').act(async () => { await new Promise((r) => setTimeout(r, ms)); });

  it('a JPEG 2000 face image is shown as a converted JPEG (first "preparing", then the picture)', async () => {
    render(<DocumentView doc={{ ...doc({ mime: 'image/jp2', bytes: jp2 }), access: 'bac', protocol: 'BAC (3DES)', mrzText: '', com: null, files: [], integrity: null, warnings: [] }} />);
    expect(q('id-photo-converting')).not.toBeNull();
    await wait(300);
    expect(q('id-photo-converting')).toBeNull();
    expect(q('id-photo')).not.toBeNull();
    expect(q('id-photo-jp2')).toBeNull();
  });

  it('an image that cannot be converted: the words say it is kept in the storage', async () => {
    render(<DocumentView doc={{ ...doc({ mime: 'image/jp2', bytes: new Uint8Array(300).fill(5) }), access: 'bac', protocol: 'BAC (3DES)', mrzText: '', com: null, files: [], integrity: null, warnings: [] }} />);
    await wait(300);
    expect(q('id-photo')).toBeNull();
    expect(text('id-photo-jp2')).toContain('kept in the file storage');
  });
});
