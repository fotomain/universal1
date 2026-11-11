/** @jest-environment jsdom */
// The viewer route /files/view: the file is SHOWN by its kind; only a kind the browser cannot show gets a Download button as the way to get it.
import React, { act } from 'react';
import { Platform } from 'react-native';

let mockParams: Record<string, string> = { post: 'p1' };
const mockFetchUrl = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#00f', error: '#f00', border: '#ccc' } }) }));
jest.mock('../../kit8/files/filesDriveApi', () => ({ ...jest.requireActual('../../kit8/files/filesDriveApi'), fetchDownloadUrl: (...a: any[]) => mockFetchUrl(...a) }));

import FileViewer from '../../kit8/files/FileViewer';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const settle = async () => { await act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); }); };

async function show(file: { name: string; mimeType: string; size?: number }) {
  mockFetchUrl.mockResolvedValue({ ok: true, data: { url: 'https://fn.test/dl?sig=1', size: 10, ...file } });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<FileViewer />); });
  await settle();
  return { host, done: () => { act(() => root.unmount()); host.remove(); } };
}
const q = (host: HTMLElement, id: string) => host.querySelector(`[data-testid="file-viewer-${id}"]`) as HTMLElement | null;

describe('FileViewer (web)', () => {
  beforeAll(() => { (Platform as any).OS = 'web'; });
  beforeEach(() => { mockFetchUrl.mockReset(); mockParams = { post: 'p1' }; });

  it('an image is an <img> of the signed link, a video a <video controls>, audio an <audio controls>', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 200, headers: { get: () => null }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }));
    Object.defineProperty(globalThis, 'URL', { configurable: true, writable: true, value: { createObjectURL: jest.fn(() => 'blob:img-1'), revokeObjectURL: jest.fn() } });
    let v = await show({ name: 'a.png', mimeType: 'image/png' });
    await settle();
    expect(q(v.host, 'image')!.getAttribute('src')).toBe('blob:img-1');
    v.done();
    v = await show({ name: 'a.mp4', mimeType: 'video/mp4' });
    expect(q(v.host, 'video')!.getAttribute('src')).toBe('https://fn.test/dl?sig=1');
    v.done();
    v = await show({ name: 'a.mp3', mimeType: 'audio/mpeg' });
    expect(q(v.host, 'audio')).not.toBeNull();
    v.done();
    expect(mockFetchUrl).toHaveBeenCalledWith('p1');
  });
  it('an image the function refuses is NOT an empty picture: the answer is shown in words', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: false, status: 404, text: async () => '{"error":"File not found"}' }));
    const v = await show({ name: 'a.jpg', mimeType: 'image/jpeg' });
    await settle();
    expect(q(v.host, 'image')).toBeNull();
    expect(v.host.textContent).toContain('HTTP 404');
    expect(v.host.textContent).toContain('File not found');
    v.done();
  });
  it('text and markdown are read and shown as text', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => '# Title\nhello' }));
    const v = await show({ name: 'notes.md', mimeType: 'text/markdown' });
    await settle();
    expect(v.host.textContent).toContain('# Title');
    expect(v.host.textContent).toContain('hello');
    v.done();
  });
  it('a pdf is read into a Blob and shown in an iframe', async () => {
    (globalThis as any).fetch = jest.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer }));
    Object.defineProperty(globalThis, 'URL', { configurable: true, writable: true, value: { createObjectURL: jest.fn(() => 'blob:pdf-1'), revokeObjectURL: jest.fn() } });
    const v = await show({ name: 'plan.pdf', mimeType: 'application/pdf' });
    await settle();
    expect(q(v.host, 'pdf')!.getAttribute('src')).toBe('blob:pdf-1');
    v.done();
  });
  it('a kind the browser cannot show (zip) says so and offers Download as the only way', async () => {
    const v = await show({ name: 'a.zip', mimeType: 'application/zip' });
    expect(q(v.host, 'other')).not.toBeNull();
    expect(q(v.host, 'download')).not.toBeNull();
    v.done();
  });
  it('a refusal of the function is shown in words; no post = no file chosen', async () => {
    mockFetchUrl.mockResolvedValue({ ok: false, error: 'No permission (noPermission).' });
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<FileViewer />); });
    await settle();
    expect(host.textContent).toContain('No permission');
    act(() => root.unmount());
    mockParams = {};
    const root2 = createRoot(host);
    await act(async () => { root2.render(<FileViewer />); });
    expect(host.textContent).toContain('No file was chosen');
    act(() => root2.unmount()); host.remove();
  });
});
