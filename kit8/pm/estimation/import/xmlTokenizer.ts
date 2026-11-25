// A small streaming XML tokenizer (pure, no DOM): the norm books are 20 - 85 MB files, a DOMParser would hold the whole tree. It turns bytes into open / close / text events one tag at a time,
// decoding the UTF-8 bytes in windows. Enough for the data files of the norm books (elements, attributes, text; comments, declarations and CDATA are skipped / read as text).
export type XmlEvent =
  | { type: 'open'; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: 'close'; name: string }
  | { type: 'text'; text: string };

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const decodeEntities = (s: string): string =>
  s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') { const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(code) ? String.fromCodePoint(code) : m; }
    return ENTITY[e] ?? m;
  });

const TAG = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<![A-Za-z][^>]*>/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!src) return out;
  ATTR.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR.exec(src))) out[m[1]] = decodeEntities(m[2] ?? m[3] ?? '');
  return out;
}

/** events of a UTF-8 file; `windowBytes` bounds the decoded text held at once (a tag cut by the end of a window is carried over to the next one) */
export function* xmlEvents(bytes: Uint8Array, windowBytes = 4 * 1024 * 1024): Generator<XmlEvent> {
  const decoder = new TextDecoder('utf-8');
  let at = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let carry = '';
  for (;;) {
    const end = Math.min(bytes.length, at + windowBytes);
    const buf = carry + decoder.decode(bytes.subarray(at, end), { stream: end < bytes.length });
    at = end;
    const final = at >= bytes.length;
    let consumed = 0;
    TAG.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG.exec(buf))) {
      if (m.index > consumed) {
        const t = buf.slice(consumed, m.index);
        if (t.trim()) yield { type: 'text', text: decodeEntities(t) };
      }
      consumed = m.index + m[0].length;
      if (m[2]) {
        if (m[1]) yield { type: 'close', name: m[2] };
        else {
          yield { type: 'open', name: m[2], attrs: parseAttrs(m[3]), selfClosing: m[4] === '/' };
          if (m[4] === '/') yield { type: 'close', name: m[2] };
        }
      } else if (m[5] !== undefined && m[5].trim()) {
        yield { type: 'text', text: m[5] };
      }
    }
    const rest = buf.slice(consumed);
    if (final) {
      if (rest.trim() && rest.indexOf('<') < 0) yield { type: 'text', text: decodeEntities(rest) };
      return;
    }
    const lt = rest.indexOf('<');
    if (lt < 0) carry = rest;                                   // text that may go on in the next window
    else {
      const t = rest.slice(0, lt);
      if (t.trim()) yield { type: 'text', text: decodeEntities(t) };
      carry = rest.slice(lt);                                   // a tag cut by the window
    }
  }
}
