// The SYSTEM font of the browser for the Skia canvases (web only). CanvasKit has no access to the fonts of the machine, it needs the BYTES of a font file. Chrome / Edge give them through the Local Font
// Access API (`window.queryLocalFonts()`): it needs a permission and, for the prompt, a click of the user. `prepareSystemFont()` therefore takes the bytes ONCE and keeps them in IndexedDB:
//   - a copy is there already                   -> nothing to do (every later start reads IndexedDB, no prompt);
//   - the permission is already granted         -> copied at once, silently;
//   - the permission is still to be asked       -> asked at the FIRST click / key of the user on a dashboard (the browser shows its own prompt, once; a dismissed prompt is not repeated);
//   - denied / no such API (Safari, Firefox)    -> the canvases draw `system` with Inter (usePMFonts.ts), the closest open font to San Francisco (Safari gives a page no way to read
//                                                  its system font, and the SF licence forbids shipping it); the Settings button can try again.
// The API lists fonts by NAME, there is no "give me system-ui": a list of the usual system fonts per platform is tried (SF Pro when the user has installed it, else Helvetica Neue / Segoe UI / ...).
// The copy lives in this browser only (never sent anywhere).

export type SystemFontRole = 'regular' | 'medium' | 'bold';
export const SYSTEM_FONT_ROLES: SystemFontRole[] = ['regular', 'medium', 'bold'];

export interface StoredSystemFont { family: string; faces: Partial<Record<SystemFontRole, Uint8Array>> }

export type CaptureResult =
  | { ok: true; family: string; roles: SystemFontRole[] }
  | { ok: false; reason: 'unsupported' | 'denied' | 'notfound' | 'failed' };

/** families to try, best first (the first one that has a Regular face wins) */
export function systemFontCandidates(userAgent: string): string[] {
  const ua = userAgent || '';
  if (/Windows/i.test(ua)) return ['Segoe UI Variable Text', 'Segoe UI', 'Arial'];
  if (/Mac OS X|Macintosh/i.test(ua)) return ['SF Pro Text', 'SF Pro', 'SF Pro Display', '.SF NS', 'Helvetica Neue', 'Helvetica', 'Arial'];
  if (/Android/i.test(ua)) return ['Roboto', 'Noto Sans', 'Arial'];
  return ['Noto Sans', 'DejaVu Sans', 'Liberation Sans', 'Arial'];
}

/** the role of a face by its style name ("Regular", "Roman", "Book", "Medium", "Semibold", "Bold") - italics and the other widths / weights are not used */
export function roleOfStyle(style: string): SystemFontRole | null {
  const s = (style || '').trim().toLowerCase();
  if (!s || /italic|oblique|condensed|narrow|light|thin|black|heavy|ultra|compressed/.test(s)) return null;
  if (s === 'regular' || s === 'roman' || s === 'book' || s === 'normal') return 'regular';
  if (s === 'medium') return 'medium';
  if (s === 'bold') return 'bold';
  return null;
}

/** a TrueType / OpenType file (a collection `ttcf` is refused: FreeType would take its first face, which may be another one) */
export function looksLikeFontFile(b: Uint8Array): boolean {
  if (b.length < 1000) return false;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  return tag === '\u0000\u0001\u0000\u0000' || tag === 'true' || tag === 'OTTO';
}

export const isSystemFontCaptureSupported = (): boolean => typeof window !== 'undefined' && typeof (window as any).queryLocalFonts === 'function' && typeof indexedDB !== 'undefined';

// ---- IndexedDB ----
const DB_NAME = 'kit8-system-font';
const STORE = 'fonts';
const KEY = 'system';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(): Promise<StoredSystemFont | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve((r.result as StoredSystemFont) ?? null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

async function dbPut(value: StoredSystemFont | null): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const r = value ? store.put(value, KEY) : store.delete(KEY);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

// ---- the copy in memory + the listeners (the canvases and the Settings button follow it) ----
let current: StoredSystemFont | null = null;
let loaded = false;
let loading: Promise<StoredSystemFont | null> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribeSystemFont = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getSystemFontSnapshot = (): StoredSystemFont | null => current;

/** reads the copy from IndexedDB once (null without one, in a browser without IndexedDB, in a unit test) */
export function loadStoredSystemFont(): Promise<StoredSystemFont | null> {
  if (loaded) return Promise.resolve(current);
  if (!loading) {
    loading = (async () => {
      try {
        current = typeof indexedDB === 'undefined' ? null : await dbGet();
      } catch {
        current = null;
      }
      loaded = true;
      notify();
      return current;
    })();
  }
  return loading;
}

/** Asks the browser for the system font and keeps it. MUST run inside a click (the permission prompt needs the gesture). */
export async function captureSystemFont(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): Promise<CaptureResult> {
  if (!isSystemFontCaptureSupported()) return { ok: false, reason: 'unsupported' };
  let list: any[];
  try {
    list = await (window as any).queryLocalFonts();
  } catch (e: any) {
    return { ok: false, reason: e?.name === 'SecurityError' || e?.name === 'NotAllowedError' ? 'denied' : 'failed' };
  }
  if (!Array.isArray(list) || list.length === 0) return { ok: false, reason: 'denied' };
  try {
    // the first family with a Regular AND a Bold face (a family with a Regular only - a variable font - is the second choice: its bold would be faked)
    const pickedOf = (family: string) => {
      const picked: Partial<Record<SystemFontRole, any>> = {};
      for (const f of list.filter((x) => String(x.family).toLowerCase() === family.toLowerCase())) {
        const role = roleOfStyle(f.style);
        if (role && !picked[role]) picked[role] = f;
      }
      return picked;
    };
    const candidates = systemFontCandidates(userAgent).map(pickedOf).filter((p) => p.regular);
    const best = candidates.find((p) => p.bold) ?? candidates[0];
    if (best) {
      const faces: StoredSystemFont['faces'] = {};
      for (const role of SYSTEM_FONT_ROLES) {
        const f = best[role];
        if (!f) continue;
        const bytes = new Uint8Array(await (await f.blob()).arrayBuffer());
        if (looksLikeFontFile(bytes)) faces[role] = bytes;
      }
      if (faces.regular) {
        const value: StoredSystemFont = { family: best.regular.family, faces };
        await dbPut(value);
        current = value;
        loaded = true;
        notify();
        return { ok: true, family: value.family, roles: SYSTEM_FONT_ROLES.filter((r) => !!faces[r]) };
      }
    }
    return { ok: false, reason: 'notfound' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** forgets the copy (the canvases go back to their own font) */
export async function clearSystemFont(): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') await dbPut(null);
  } catch {
    // nothing to forget
  }
  current = null;
  loaded = true;
  notify();
}

/** the face the canvas wants: header weight 500 = medium (bold when the family has no medium - the canvases' header was bold before), 700 = bold, else regular */
export function roleForWeight(weight: number | undefined): SystemFontRole {
  const w = typeof weight === 'number' ? weight : 400;
  return w >= 650 ? 'bold' : w >= 450 ? 'medium' : 'regular';
}
export function faceBytes(font: StoredSystemFont | null, role: SystemFontRole): Uint8Array | null {
  if (!font) return null;
  return font.faces[role] ?? (role === 'medium' ? font.faces.bold ?? font.faces.regular : role === 'bold' ? font.faces.regular : null) ?? null;
}

// ---- the automatic preparation ----
const ASKED_KEY = 'kit8SystemFontAsked';
let preparing: Promise<void> | null = null;
const safeStorage = {
  get: (): string | null => { try { return localStorage.getItem(ASKED_KEY); } catch { return null; } },
  set: () => { try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* private window */ } },
};

/** Makes the system font ready for the canvases (see the top of the file). Safe to call many times, from every canvas; web only. */
export function prepareSystemFont(): Promise<void> {
  if (!preparing) {
    preparing = (async () => {
      if (typeof window === 'undefined') return;
      if (await loadStoredSystemFont()) return;
      if (!isSystemFontCaptureSupported()) return;
      let state: string = 'prompt';
      try {
        state = (await (navigator as any).permissions.query({ name: 'local-fonts' })).state;
      } catch {
        // an older Chromium: the first click decides
      }
      if (state === 'denied') return;
      if (state === 'granted') { await captureSystemFont(); return; }
      if (safeStorage.get()) return; // asked before and dismissed: the Settings button remains
      const events = ['pointerdown', 'pointerup', 'keydown'] as const;
      const go = () => {
        events.forEach((e) => window.removeEventListener(e, go, true));
        safeStorage.set();
        void captureSystemFont();
      };
      events.forEach((e) => window.addEventListener(e, go, true));
    })().catch(() => undefined);
  }
  return preparing;
}
export const resetPrepareForTest = () => { preparing = null; };
