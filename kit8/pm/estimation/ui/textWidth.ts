// The width of a short text in px as the screen draws it: a column that must be as narrow as its word (the Select link of the norm window) needs it.
// Web: a canvas measures the real font; elsewhere (and where there is no canvas, e.g. a test) an estimate by the length.
const cache = new Map<string, number>();

export function textWidthPx(text: string, fontSize = 14, fontWeight: string = '400'): number {
  const key = `${fontWeight}|${fontSize}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let w = 0;
  try {
    const doc: any = (globalThis as any).document;
    // jsdom (the tests) has no canvas: the estimate below is used
    if (/jsdom/i.test(String((globalThis as any).navigator?.userAgent ?? ''))) throw new Error('no canvas');
    const canvas = doc?.createElement?.('canvas');
    const ctx = canvas?.getContext?.('2d');
    if (ctx) {
      const family = (globalThis as any).getComputedStyle?.(doc.body)?.fontFamily || 'sans-serif';
      ctx.font = `${fontWeight} ${fontSize}px ${family}`;
      w = ctx.measureText(text).width;
    }
  } catch { w = 0; }
  if (!(w > 0)) w = Math.round(text.length * fontSize * 0.58);
  w = Math.ceil(w);
  cache.set(key, w);
  return w;
}
