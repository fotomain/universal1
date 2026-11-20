/** @jest-environment node */
// takeBackgroundTag: the native getBackgroundTag crashed the app when it was called twice before the clear (ObjectAlreadyConsumedException).
const mockNfc: any = { calls: [] as string[], tag: null as any, getDelay: 0, failGet: false, failClear: false };
jest.mock('react-native-nfc-manager', () => ({
  __esModule: true,
  NfcEvents: { DiscoverTag: 'd', SessionClosed: 's', DiscoverBackgroundTag: 'b' },
  NfcAdapter: {},
  NfcTech: {},
  default: {
    start: async () => { mockNfc.calls.push('start'); },
    getBackgroundTag: async () => {
      mockNfc.calls.push('get');
      if (mockNfc.getDelay) await new Promise((r) => setTimeout(r, mockNfc.getDelay));
      if (mockNfc.failGet) throw new Error('native');
      const t = mockNfc.tag;
      mockNfc.tag = null; // the native object can be given out ONCE
      return t;
    },
    clearBackgroundTag: async () => { mockNfc.calls.push('clear'); if (mockNfc.failClear) throw new Error('clear'); },
    setEventListener: () => undefined,
  },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { takeBackgroundTag } from '../../kit8/ui/components/media/nfc/nfcReader';

const TAG = { id: '04AA', ndefMessage: [] };
beforeEach(() => { Object.assign(mockNfc, { calls: [], tag: null, getDelay: 0, failGet: false, failClear: false }); });

it('a tag is taken and cleared', async () => {
  mockNfc.tag = TAG;
  expect(await takeBackgroundTag()).toEqual(TAG);
  expect(mockNfc.calls.filter((c: string) => c !== 'start')).toEqual(['get', 'clear']);
});

it('no tag: nothing to clear, null', async () => {
  expect(await takeBackgroundTag()).toBeNull();
  expect(mockNfc.calls).not.toContain('clear');
});

it('TWO callers at once (the app came to the front twice) share ONE native call: getBackgroundTag runs once', async () => {
  mockNfc.tag = TAG;
  mockNfc.getDelay = 20;
  const [a, b, c] = await Promise.all([takeBackgroundTag(), takeBackgroundTag(), takeBackgroundTag()]);
  expect(a).toEqual(TAG);
  expect(b).toEqual(TAG);
  expect(c).toEqual(TAG);
  expect(mockNfc.calls.filter((x: string) => x === 'get')).toHaveLength(1);
  expect(mockNfc.calls.filter((x: string) => x === 'clear')).toHaveLength(1);
});

it('the next call after it has finished asks again (a new tag may have come)', async () => {
  mockNfc.tag = TAG;
  await takeBackgroundTag();
  mockNfc.tag = { id: '04BB', ndefMessage: [] };
  expect(await takeBackgroundTag()).toEqual({ id: '04BB', ndefMessage: [] });
  expect(mockNfc.calls.filter((x: string) => x === 'get')).toHaveLength(2);
});

it('a failing native call or a failing clear never throws and never leaves the lock closed', async () => {
  mockNfc.failGet = true;
  expect(await takeBackgroundTag()).toBeNull();
  mockNfc.failGet = false;
  mockNfc.failClear = true;
  mockNfc.tag = TAG;
  expect(await takeBackgroundTag()).toEqual(TAG); // the tag is still given, the failed clear is ignored
  mockNfc.failClear = false;
  mockNfc.tag = { id: '04CC', ndefMessage: [] };
  expect(await takeBackgroundTag()).toEqual({ id: '04CC', ndefMessage: [] }); // the lock was released
});
