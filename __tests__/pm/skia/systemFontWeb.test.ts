/** @jest-environment jsdom */
// The system font of the browser for the Skia canvases: which faces are picked, the copy in IndexedDB, the refusals. The browser API and IndexedDB are faked.
import {
  captureSystemFont, clearSystemFont, prepareSystemFont, resetPrepareForTest, faceBytes, getSystemFontSnapshot, isSystemFontCaptureSupported, loadStoredSystemFont, looksLikeFontFile, roleForWeight, roleOfStyle, systemFontCandidates,
} from '../../../kit8/pm/skia/systemFontWeb';

const ttf = (mark: number) => { const b = new Uint8Array(2000); b.set([0, 1, 0, 0]); b[10] = mark; return b; };
const face = (family: string, style: string, bytes: Uint8Array) => ({ family, style, fullName: `${family} ${style}`, blob: async () => ({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }) });

// a tiny IndexedDB: one database, one store, requests answer on a later tick
function installFakeIndexedDb() {
  const data = new Map<string, any>();
  const later = (req: any, result: any) => setTimeout(() => { req.result = result; req.onsuccess && req.onsuccess(); }, 0);
  (global as any).indexedDB = {
    open: () => {
      const req: any = {};
      const store = {
        get: (k: string) => { const r: any = {}; later(r, data.get(k)); return r; },
        put: (v: any, k: string) => { const r: any = {}; data.set(k, v); later(r, k); return r; },
        delete: (k: string) => { const r: any = {}; data.delete(k); later(r, undefined); return r; },
      };
      req.result = { createObjectStore: () => store, transaction: () => ({ objectStore: () => store }), close: () => undefined };
      setTimeout(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0);
      return req;
    },
  };
  return data;
}

describe('pure rules', () => {
  it('the families tried per platform', () => {
    expect(systemFontCandidates('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')[0]).toBe('SF Pro Text');
    expect(systemFontCandidates('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toContain('Segoe UI');
    expect(systemFontCandidates('X11; Linux x86_64')).toContain('Noto Sans');
  });
  it('the role of a face by its style', () => {
    expect(roleOfStyle('Regular')).toBe('regular');
    expect(roleOfStyle('Roman')).toBe('regular');
    expect(roleOfStyle('Medium')).toBe('medium');
    expect(roleOfStyle('Bold')).toBe('bold');
    expect(roleOfStyle('Bold Italic')).toBeNull();
    expect(roleOfStyle('Light')).toBeNull();
    expect(roleOfStyle('Condensed Bold')).toBeNull();
  });
  it('a font file, not a collection or a page', () => {
    expect(looksLikeFontFile(ttf(1))).toBe(true);
    expect(looksLikeFontFile(Uint8Array.from('<!doctype html>'.repeat(200), (ch) => ch.charCodeAt(0)))).toBe(false);
    const c = new Uint8Array(2000); c.set([0x74, 0x74, 0x63, 0x66]);
    expect(looksLikeFontFile(c)).toBe(false);
  });
  it('weight -> face', () => {
    expect(roleForWeight(400)).toBe('regular');
    expect(roleForWeight(500)).toBe('medium');
    expect(roleForWeight(700)).toBe('bold');
    expect(roleForWeight(undefined)).toBe('regular');
  });
  it('a missing medium is the bold one (the header was bold before)', () => {
    const f = { family: 'A', faces: { regular: ttf(1), bold: ttf(2) } };
    expect(faceBytes(f, 'medium')).toBe(f.faces.bold);
    expect(faceBytes(null, 'regular')).toBeNull();
  });
});

describe('capture', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
  let data: Map<string, any>;
  beforeEach(() => { data = installFakeIndexedDb(); });
  afterEach(async () => { await clearSystemFont(); delete (window as any).queryLocalFonts; delete (global as any).indexedDB; });

  it('without the API: unsupported', async () => {
    expect(isSystemFontCaptureSupported()).toBe(false);
    expect(await captureSystemFont(mac)).toEqual({ ok: false, reason: 'unsupported' });
  });
  it('the permission refused: denied', async () => {
    (window as any).queryLocalFonts = async () => { const e: any = new Error('no'); e.name = 'SecurityError'; throw e; };
    expect(await captureSystemFont(mac)).toEqual({ ok: false, reason: 'denied' });
  });
  it('no usable family: notfound', async () => {
    (window as any).queryLocalFonts = async () => [face('Comic Sans', 'Regular', ttf(1))];
    expect(await captureSystemFont(mac)).toEqual({ ok: false, reason: 'notfound' });
  });
  it('takes the first family with a Regular face, its Medium and Bold, and keeps them', async () => {
    (window as any).queryLocalFonts = async () => [
      face('Helvetica Neue', 'Italic', ttf(9)), face('Helvetica Neue', 'Regular', ttf(1)), face('Helvetica Neue', 'Medium', ttf(2)), face('Helvetica Neue', 'Bold', ttf(3)), face('Arial', 'Regular', ttf(7)),
    ];
    const r = await captureSystemFont(mac);
    expect(r).toEqual({ ok: true, family: 'Helvetica Neue', roles: ['regular', 'medium', 'bold'] });
    expect(getSystemFontSnapshot()?.faces.medium?.[10]).toBe(2);
    expect(data.get('system').family).toBe('Helvetica Neue');
  });
  it('SF Pro wins when the user has it; a face that is not a font file is dropped', async () => {
    (window as any).queryLocalFonts = async () => [face('Helvetica Neue', 'Regular', ttf(1)), face('SF Pro Text', 'Regular', ttf(5)), face('SF Pro Text', 'Bold', new Uint8Array(2000))];
    const r: any = await captureSystemFont(mac);
    expect(r.family).toBe('SF Pro Text');
    expect(r.roles).toEqual(['regular']);
  });
  it('the copy is read back after a restart; clear forgets it', async () => {
    data.set('system', { family: 'Segoe UI', faces: { regular: ttf(4) } });
    // a fresh module state = a new page load
    jest.resetModules();
    const fresh = require('../../../kit8/pm/skia/systemFontWeb');
    const got = await fresh.loadStoredSystemFont();
    expect(got?.family).toBe('Segoe UI');
    await fresh.clearSystemFont();
    expect(fresh.getSystemFontSnapshot()).toBeNull();
    expect(data.has('system')).toBe(false);
  });
  it('without IndexedDB (a unit test) nothing is stored', async () => {
    delete (global as any).indexedDB;
    expect(await loadStoredSystemFont()).toBeNull();
  });
  it('a family with Regular and Bold wins over a regular-only (variable) one that comes first', async () => {
    (window as any).queryLocalFonts = async () => [face('SF Pro Text', 'Regular', ttf(5)), face('Helvetica Neue', 'Regular', ttf(1)), face('Helvetica Neue', 'Bold', ttf(3))];
    const r: any = await captureSystemFont(mac);
    expect(r.family).toBe('Helvetica Neue');
  });
});

describe('prepareSystemFont (automatic)', () => {
  beforeAll(() => { Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', configurable: true }); });
  const faces = () => [face('Helvetica Neue', 'Regular', ttf(1)), face('Helvetica Neue', 'Bold', ttf(3))];
  let perm: string;
  let query: jest.Mock;
  const setup = () => {
    installFakeIndexedDb();
    perm = 'prompt';
    query = jest.fn(async () => faces());
    (window as any).queryLocalFonts = query;
    (navigator as any).permissions = { query: async () => ({ state: perm }) };
    try { localStorage.clear(); } catch { /* none */ }
    resetPrepareForTest();
    jest.resetModules();
  };
  afterEach(async () => { delete (window as any).queryLocalFonts; delete (global as any).indexedDB; });
  const fresh = () => require('../../../kit8/pm/skia/systemFontWeb');

  it('permission granted: copied at once, no click needed', async () => {
    setup(); perm = 'granted';
    const m = fresh();
    await m.prepareSystemFont();
    expect(query).toHaveBeenCalledTimes(1);
    expect(m.getSystemFontSnapshot()?.family).toBe('Helvetica Neue');
  });
  it('permission to be asked: waits for the first click, asks once, then never again', async () => {
    setup();
    const m = fresh();
    await m.prepareSystemFont();
    expect(query).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('pointerup'));
    await new Promise((r) => setTimeout(r, 30));
    expect(query).toHaveBeenCalledTimes(1);
    expect(m.getSystemFontSnapshot()?.family).toBe('Helvetica Neue');
  });
  it('a prompt that was dismissed before is not shown again (the flag of this browser)', async () => {
    setup();
    localStorage.setItem('kit8SystemFontAsked', '1');
    const m = fresh();
    await m.prepareSystemFont();
    window.dispatchEvent(new Event('pointerdown'));
    await new Promise((r) => setTimeout(r, 10));
    expect(query).not.toHaveBeenCalled();
  });
  it('denied: nothing, no listener', async () => {
    setup(); perm = 'denied';
    const m = fresh();
    await m.prepareSystemFont();
    window.dispatchEvent(new Event('pointerdown'));
    await new Promise((r) => setTimeout(r, 10));
    expect(query).not.toHaveBeenCalled();
  });
  it('a copy kept from an earlier visit: no question at all', async () => {
    setup();
    const m0 = fresh();
    perm = 'granted';
    await m0.prepareSystemFont();
    query.mockClear();
    resetPrepareForTest();
    jest.resetModules();
    const m1 = fresh();
    perm = 'prompt';
    await m1.prepareSystemFont();
    expect(query).not.toHaveBeenCalled();
    expect(m1.getSystemFontSnapshot()?.family).toBe('Helvetica Neue');
  });
});
