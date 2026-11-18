/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';

const reader: any = { availability: 'ready', onTag: null as any, onClosed: null as any, started: 0, stopped: 0, startError: null as any };
(globalThis as any).__nfc = reader;
jest.mock('../../kit8/ui/components/media/nfc/nfcReader', () => ({
  nfcAvailability: async () => (globalThis as any).__nfc.availability,
  startNfcReader: async (onTag: any, onClosed: any) => {
    const r = (globalThis as any).__nfc;
    if (r.startError) throw r.startError;
    r.onTag = onTag; r.onClosed = onClosed; r.started += 1;
    return { stop: async () => { r.stopped += 1; } };
  },
  openNfcSettings: jest.fn(async () => undefined),
  takeBackgroundTag: jest.fn(async () => null),
  listenBackgroundTags: () => () => undefined,
}));
const mockClip = jest.fn(async (_: string) => true);
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockClip(t) }));
const mockWrite = jest.fn(async (build: any) => build({ ownerGUID: 'u1', rowGUID: 'r1', platform: 'ios' }, undefined));
jest.mock('../../kit8/ui/components/media/common/useWriteMediaPost', () => ({ useWriteMediaPost: () => mockWrite, useIsSignedIn: () => true }));

import NfcScan, { nfcStatusText } from '../../kit8/ui/components/media/nfc/NfcScan';
import { clearNfcInbox, getNfcInbox, pushNfcRead } from '../../kit8/ui/components/media/nfc/nfcInbox';
import { makeReceived } from '../../kit8/ui/components/media/nfc/nfcModel';
import { Linking, Platform } from 'react-native';

const bytes = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const link = { id: '04A1B2C3', techTypes: ['android.nfc.tech.Ndef'], ndefMessage: [{ tnf: 1, type: [0x55], payload: [4, ...bytes('example.com/tag')] }] };

beforeEach(() => { Object.assign(reader, { availability: 'ready', onTag: null, onClosed: null, started: 0, stopped: 0, startError: null }); clearNfcInbox(); });
afterEach(() => { cleanup(); clearNfcInbox(); jest.clearAllMocks(); });

it('the reader starts by itself (not iOS), says it is ready, and every tag it reads is listed - one after the other, no button', async () => {
  render(<NfcScan />);
  await flush();
  expect(reader.started).toBe(1);
  expect(text('nfc-status')).toContain('Ready');
  expect(q('nfc-empty')).not.toBeNull();
  act(() => reader.onTag(link));
  act(() => reader.onTag({ id: '04FFEEDD', ndefMessage: [{ tnf: 1, type: [0x54], payload: [2, 0x65, 0x6e, ...bytes('hi')] }] }));
  expect(getNfcInbox().map((r) => r.info.id)).toEqual(['04FFEEDD', '04A1B2C3']);
  expect(q('nfc-received')).not.toBeNull();
  const first = getNfcInbox()[1];
  expect(text(`nfc-read-summary-${first.key}`)).toBe('Link · https://example.com/tag');
});

it('Open, Copy and Remove of a read; Clear empties the list', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  render(<NfcScan />);
  await flush();
  act(() => reader.onTag(link));
  const { key } = getNfcInbox()[0];
  await pressAsync(`nfc-open-${key}`);
  expect(open).toHaveBeenCalledWith('https://example.com/tag');
  await pressAsync(`nfc-copy-${key}`);
  expect(mockClip).toHaveBeenCalledWith(expect.stringContaining('Tag id: 04A1B2C3'));
  press(`nfc-remove-${key}`);
  expect(getNfcInbox()).toHaveLength(0);
  act(() => reader.onTag(link));
  press('nfc-clear');
  expect(q('nfc-empty')).not.toBeNull();
});

it('a read can become a media post', async () => {
  render(<NfcScan />);
  await flush();
  act(() => reader.onTag(link));
  const { key } = getNfcInbox()[0];
  await pressAsync(`nfc-post-${key}-create`);
  const post = await mockWrite.mock.results[0].value;
  expect(post.rowJSON).toMatchObject({ dataOriginName: 'nfc', nfcTagId: '04A1B2C3', mediaPostSubTitle: 'Link · https://example.com/tag' });
});

it('a tag that came in the background (it started the app) is in the list and marked', async () => {
  pushNfcRead(makeReceived(link, 'background'));
  render(<NfcScan />);
  await flush();
  const { key } = getNfcInbox()[0];
  expect(text(`nfc-read-summary-${key}`)).toContain('Link');
  expect(q(`nfc-read-${key}`)!.textContent).toContain('background');
});

it('a tag with no message is still shown, with its id', async () => {
  render(<NfcScan />);
  await flush();
  act(() => reader.onTag({ id: '0499', techTypes: ['android.nfc.tech.NfcA'] }));
  const { key } = getNfcInbox()[0];
  expect(q(`nfc-read-${key}`)!.textContent).toContain('no NDEF message');
  expect(text(`nfc-tech-${key}`)).toContain('Id 0499');
});

it('NFC off / no NFC / start error are said in words; the reader is not started', async () => {
  reader.availability = 'disabled';
  render(<NfcScan />);
  await flush();
  expect(text('nfc-status')).toContain('switched off');
  expect(reader.started).toBe(0);
  cleanup();
  reader.availability = 'unsupported';
  render(<NfcScan />);
  await flush();
  expect(text('nfc-status')).toMatch(/no NFC|cannot read NFC/);
  cleanup();
  reader.availability = 'ready';
  reader.startError = new Error('NFC busy');
  render(<NfcScan />);
  await flush();
  expect(text('nfc-status')).toBe('NFC busy');
  expect(q('nfc-start')).not.toBeNull();
});

it('Stop stops the reader; Scan starts it again; closing the screen stops it', async () => {
  render(<NfcScan />);
  await flush();
  await pressAsync('nfc-stop');
  expect(reader.stopped).toBe(1);
  expect(text('nfc-status')).toBe('Stopped.');
  await pressAsync('nfc-start');
  expect(reader.started).toBe(2);
  cleanup();
  expect(reader.stopped).toBeGreaterThanOrEqual(2);
});

it('status texts', () => {
  expect(nfcStatusText('stopped', true, '')).toContain('Press Scan');
  expect(nfcStatusText('checking', false, '')).toContain('Checking');
  expect(Platform.OS).toBeDefined();
});
