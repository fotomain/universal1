// The first hold of the document on Android (2026-11-23): the library switches the reader mode on BEFORE the native request exists, so a document that
// already lies on the phone is found with nobody waiting and dropped. openIsoDep switches the reader mode on again with other flags once the request waits.
import { Platform } from 'react-native';

const mockCalls: string[] = [];
const mockFlags: number[] = [];
let mockFound: ((v?: unknown) => void) | null = null;
let mockRequestMade = false;
/** the antenna finds the document at this look again (1 = the first one after the request) */
let mockFindAtLook = 1;

jest.mock('react-native-nfc-manager', () => {
  const NfcManager = {
    start: async () => undefined,
    unregisterTagEvent: jest.fn(async () => { mockCalls.push('unregister'); }),
    registerTagEvent: jest.fn(async (o: any) => {
      mockCalls.push('register');
      mockFlags.push(o.readerModeFlags);
      // the antenna looks again only when the flags CHANGED while a request waits (new discovery parameters): then the document in the field is found
      if (mockRequestMade && mockFlags.length - 1 >= mockFindAtLook && mockFlags[mockFlags.length - 1] !== mockFlags[mockFlags.length - 2]) mockFound?.();
    }),
    requestTechnology: jest.fn(() => { mockCalls.push('request'); mockRequestMade = true; return new Promise((r) => { mockFound = r; }); }),
    cancelTechnologyRequest: jest.fn(async () => { mockCalls.push('cancel'); }),
    setTimeout: jest.fn(async () => undefined),
    getTag: jest.fn(async () => ({ id: [1, 2, 3, 4], techTypes: ['android.nfc.tech.IsoDep'] })),
    isoDepHandler: { transceive: jest.fn() },
  };
  return { __esModule: true, default: NfcManager, NfcTech: { IsoDep: 'IsoDep' }, NfcAdapter: { FLAG_READER_NFC_A: 1, FLAG_READER_NFC_B: 2, FLAG_READER_SKIP_NDEF_CHECK: 0x80, FLAG_READER_NO_PLATFORM_SOUNDS: 0x100 } };
});

import { openIsoDep } from '../../kit8/ui/components/media/nfc/iddocread/idTransport';

const realOS = Platform.OS;
beforeEach(() => { (Platform as any).OS = 'android'; mockCalls.length = 0; mockFlags.length = 0; mockFound = null; mockRequestMade = false; mockFindAtLook = 1; jest.useFakeTimers(); });
afterEach(() => { (Platform as any).OS = realOS; jest.useRealTimers(); });

it('Android: the reader mode is switched on, the request made, then the reader mode is switched on again with other flags - the first hold is found', async () => {
  const opened = openIsoDep();
  await jest.advanceTimersByTimeAsync(400);
  const transport = await opened;
  expect(mockCalls.slice(0, 4)).toEqual(['unregister', 'register', 'request', 'register']);
  expect(mockFlags[0]).not.toBe(mockFlags[1]);
  expect(transport.tag?.techTypes).toEqual(['IsoDep']);
  await transport.close();
  expect(mockCalls.slice(-2)).toEqual(['cancel', 'unregister']);
});

it('Android: nothing found yet -> the nudge repeats (alternating flags) until the document comes', async () => {
  const opened = openIsoDep();
  mockFindAtLook = 4; // found at the 4th look again
  await jest.advanceTimersByTimeAsync(100);
  expect(mockFlags).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(10000);
  expect(mockFlags.length).toBe(5);
  expect(new Set(mockFlags).size).toBe(2);
  await opened;
});
