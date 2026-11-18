import { decodeEmbeddedMessage, decodeTextPayload, decodeUriPayload, describeRecord, describeTag, isRepeatRead, makeReceived, NFC_REPEAT_MS, tagIdHex, TNF } from '../../kit8/ui/components/media/nfc/nfcModel';
import { clearNfcInbox, getNfcInbox, pushNfcRead, removeNfcRead, subscribeNfcInbox } from '../../kit8/ui/components/media/nfc/nfcInbox';

const bytes = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const textRecord = (text: string, lang = 'en') => ({ tnf: TNF.wellKnown, type: [0x54], payload: [lang.length, ...bytes(lang), ...bytes(text)] });
const uriRecord = (prefix: number, rest: string) => ({ tnf: TNF.wellKnown, type: [0x55], payload: [prefix, ...bytes(rest)] });

describe('NFC records', () => {
  it('text record: language and text, also UTF-8 and UTF-16', () => {
    expect(decodeTextPayload([2, 0x65, 0x6e, 0x68, 0x69])).toEqual({ text: 'hi', lang: 'en' });
    expect(decodeTextPayload([2, 0x64, 0x65, 0xc3, 0xa4])).toEqual({ text: 'ä', lang: 'de' });
    expect(decodeTextPayload([0x80 | 2, 0x65, 0x6e, 0xfe, 0xff, 0x00, 0x68, 0x00, 0x69])).toEqual({ text: 'hi', lang: 'en' });
    expect(decodeTextPayload([])).toEqual({ text: '', lang: '' });
    expect(decodeTextPayload([2, 0x65, 0x6e, 0xf0, 0x9f, 0x98, 0x80]).text).toBe('😀');
  });
  it('URI record: the prefix table', () => {
    expect(decodeUriPayload([4, ...bytes('example.com/x')])).toBe('https://example.com/x');
    expect(decodeUriPayload([5, ...bytes('+4912')])).toBe('tel:+4912');
    expect(decodeUriPayload([0, ...bytes('geo:1,2')])).toBe('geo:1,2');
    expect(decodeUriPayload([99, ...bytes('x')])).toBe('x');
  });
  it('describes text, link, phone and mail records', () => {
    expect(describeRecord(textRecord('hello'))).toMatchObject({ kind: 'text', label: 'Text', text: 'hello', lang: 'en', openUrl: '' });
    expect(describeRecord(uriRecord(4, 'a.b'))).toMatchObject({ kind: 'uri', label: 'Link', text: 'https://a.b', openUrl: 'https://a.b' });
    expect(describeRecord(uriRecord(5, '123'))).toMatchObject({ label: 'Phone number', openUrl: 'tel:123' });
    expect(describeRecord(uriRecord(6, 'a@b.c'))).toMatchObject({ label: 'E-mail', openUrl: 'mailto:a@b.c' });
  });
  it('a type given as text (Android) is the same as bytes (iOS)', () => {
    expect(describeRecord({ tnf: TNF.wellKnown, type: 'T', payload: textRecord('x').payload }).text).toBe('x');
  });
  it('mime, external, empty and unknown records', () => {
    expect(describeRecord({ tnf: TNF.mime, type: 'text/plain', payload: bytes('note') })).toMatchObject({ kind: 'mime', label: 'text/plain', text: 'note' });
    expect(describeRecord({ tnf: TNF.mime, type: 'application/vnd.wfa.wsc', payload: [1, 2] })).toMatchObject({ kind: 'mime', text: '' });
    expect(describeRecord({ tnf: TNF.external, type: 'example.com:t', payload: bytes('data') })).toMatchObject({ kind: 'external', typeName: 'example.com:t', text: 'data' });
    expect(describeRecord({ tnf: TNF.empty, type: [], payload: [] }).kind).toBe('empty');
    expect(describeRecord({ tnf: TNF.unknown, type: [], payload: [1] }).kind).toBe('unknown');
  });
  it('a Smart Poster holds a title and a link', () => {
    const inner = (r: { tnf: number; type: number[]; payload: number[] }, first: boolean, last: boolean) => [
      0x10 | (first ? 0x80 : 0) | (last ? 0x40 : 0) | r.tnf, r.type.length, r.payload.length, ...r.type, ...r.payload,
    ];
    const payload = [...inner(textRecord('Shop'), true, false), ...inner(uriRecord(4, 'shop.io'), false, true)];
    expect(decodeEmbeddedMessage(payload)).toHaveLength(2);
    expect(describeRecord({ tnf: TNF.wellKnown, type: [0x53, 0x70], payload })).toMatchObject({ kind: 'smartPoster', text: 'Shop\nhttps://shop.io', openUrl: 'https://shop.io' });
  });
});

describe('NFC tag', () => {
  it('the id as hex from a string or bytes', () => {
    expect(tagIdHex('04:a1:b2')).toBe('04A1B2');
    expect(tagIdHex([4, 161, 178])).toBe('04A1B2');
    expect(tagIdHex(undefined)).toBe('');
  });
  it('a tag with a link: summary, open url, lines for the post', () => {
    const info = describeTag({ id: '04A1B2C3D4E5F6', techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.Ndef'], maxSize: 504, isWritable: true, ndefMessage: [uriRecord(4, 'a.b'), textRecord('hello')] });
    expect(info).toMatchObject({ id: '04A1B2C3D4E5F6', techTypes: ['NfcA', 'Ndef'], capacity: 504, writable: true, openUrl: 'https://a.b', hasMessage: true });
    expect(info.summary).toBe('Link · https://a.b');
    expect(info.text).toBe('Tag id: 04A1B2C3D4E5F6\nLink: https://a.b\nhello');
  });
  it('a tag with no message is still a read', () => {
    const info = describeTag({ id: '04A1B2C3D4E5F6' });
    expect(info.hasMessage).toBe(false);
    expect(info.summary).toBe('Tag 04A1B2C3… · no readable message');
    expect(describeTag(null).summary).toBe('Tag with no readable message');
  });
  it('the same tag read again at once is one read', () => {
    const a = makeReceived({ id: '01', ndefMessage: [textRecord('x')] }, 'foreground', 1000);
    expect(isRepeatRead(a, describeTag({ id: '01', ndefMessage: [textRecord('x')] }), 1000 + NFC_REPEAT_MS - 1)).toBe(true);
    expect(isRepeatRead(a, describeTag({ id: '01', ndefMessage: [textRecord('x')] }), 1000 + NFC_REPEAT_MS)).toBe(false);
    expect(isRepeatRead(a, describeTag({ id: '02', ndefMessage: [textRecord('x')] }), 1001)).toBe(false);
    expect(isRepeatRead(undefined, a.info, 1)).toBe(false);
  });
});

describe('NFC inbox', () => {
  afterEach(clearNfcInbox);
  it('newest first, repeats dropped, listeners told, remove and clear', () => {
    const seen = jest.fn();
    const off = subscribeNfcInbox(seen);
    expect(pushNfcRead(makeReceived({ id: '01', ndefMessage: [textRecord('a')] }, 'foreground', 1000))).toBe(true);
    expect(pushNfcRead(makeReceived({ id: '01', ndefMessage: [textRecord('a')] }, 'foreground', 1100))).toBe(false);
    expect(pushNfcRead(makeReceived({ id: '02', ndefMessage: [textRecord('b')] }, 'background', 1200))).toBe(true);
    expect(getNfcInbox().map((r) => r.info.id)).toEqual(['02', '01']);
    expect(seen).toHaveBeenCalledTimes(2);
    removeNfcRead(getNfcInbox()[0].key);
    expect(getNfcInbox().map((r) => r.info.id)).toEqual(['01']);
    off();
    clearNfcInbox();
    expect(getNfcInbox()).toEqual([]);
    expect(seen).toHaveBeenCalledTimes(3);
  });
});
