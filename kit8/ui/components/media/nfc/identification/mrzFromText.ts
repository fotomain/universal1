// From the text lines an OCR engine gives to the three values the NFC step needs (document number, date of birth, date of expiry).
// The MRZ (ICAO 9303) is printed in the OCR-B font; OCR reads it with typical mistakes (O/0, I/1, B/8, S/5, a lost trailing `<`, `<` read as K).
// The MRZ has check digits, so mistakes can be found and repaired. Pure: no React, no native module.
import { checkDigit, MrzAccess, MrzData, MrzFormat, accessFromMrz, parseMrz } from '../iddocread/mrz';

export type MrzConfidence = 'checked' | 'partly' | 'unchecked';

export interface MrzFromText {
  format: MrzFormat;
  /** the repaired lines (30 / 36 / 44 characters) */
  lines: string[];
  mrz: MrzData;
  access: MrzAccess;
  /** checked = number, birth date, expiry date AND the composite check digit agree; partly = the three fields agree; unchecked = look at it */
  confidence: MrzConfidence;
  /** how many characters the repair changed (fewer = more trustworthy) */
  changes: number;
}

type Cls = 'A' | 'N' | 'X' | 'S';

const LEN: Record<MrzFormat, number> = { TD1: 30, TD2: 36, TD3: 44 };
const COUNT: Record<MrzFormat, number> = { TD1: 3, TD2: 2, TD3: 2 };

const repeat = (c: Cls, n: number) => c.repeat(n);
/** the class of every position: A = letter or filler, N = digit, X = letter, digit or filler, S = sex */
const CLASSES: Record<MrzFormat, string[]> = {
  TD3: [repeat('A', 44), repeat('X', 9) + 'N' + 'AAA' + 'NNNNNN' + 'N' + 'S' + 'NNNNNN' + 'N' + repeat('X', 14) + 'N' + 'N'],
  TD1: [repeat('A', 5) + repeat('X', 9) + 'N' + repeat('X', 15), 'NNNNNN' + 'N' + 'S' + 'NNNNNN' + 'N' + 'AAA' + repeat('X', 11) + 'N', repeat('A', 30)],
  TD2: [repeat('A', 36), repeat('X', 9) + 'N' + 'AAA' + 'NNNNNN' + 'N' + 'S' + 'NNNNNN' + 'N' + repeat('X', 7) + 'N'],
};

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', B: '8', S: '5', Z: '2', G: '6' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '8': 'B', '5': 'S', '2': 'Z', '6': 'G' };
/** characters that may have been confused: the alternatives tried when a check digit disagrees */
const CONFUSED: Record<string, string[]> = { O: ['0'], '0': ['O', 'D'], I: ['1'], '1': ['I', 'L'], B: ['8'], '8': ['B'], S: ['5'], '5': ['S'], Z: ['2'], '2': ['Z'], G: ['6'], '6': ['G'], D: ['0'], Q: ['0'], L: ['1'] };

/** one OCR line -> the characters of the MRZ alphabet (upper case, A-Z 0-9 <) */
export function normalizeOcrLine(raw: string): string {
  let s = raw.toUpperCase().replace(/[«‹〈＜❮]/g, '<').replace(/\s+/g, '');
  s = s.replace(/[^A-Z0-9<]/g, '');
  // the filler `<` at the end of a line is often read as a run of K, C, E, L, X or S
  s = s.replace(/([KCELXS])\1{3,}$/, (m) => '<'.repeat(m.length));
  return s;
}

/**
 * fits a line to the exact length; null when it is too far off. OCR and language models miscount the LONG RUNS of the filler `<`, so the difference is
 * taken from / given to the last run of three or more `<` (the check digits that follow it stay where they belong: a Google AI answer measured on
 * 2026-11-19 had one filler too many in the middle of line 2, and cutting the END of the line removed the composite check digit).
 * A line with no such run is padded / cut at the end.
 */
function fit(line: string, len: number): string | null {
  const diff = len - line.length;
  if (Math.abs(diff) > 4) return null;
  if (diff === 0) return line;
  const runs = [...line.matchAll(/<{3,}/g)];
  const run = runs[runs.length - 1];
  if (run && run.index !== undefined) {
    const newLen = run[0].length + diff;
    if (newLen >= 1) return line.slice(0, run.index) + '<'.repeat(newLen) + line.slice(run.index + run[0].length);
  }
  return diff > 0 ? line.padEnd(len, '<') : line.slice(0, len);
}

function repairLine(line: string, classes: string): { text: string; changes: number } {
  let out = '';
  let changes = 0;
  for (let i = 0; i < line.length; i += 1) {
    let c = line[i];
    const cls = classes[i];
    let n = c;
    if (cls === 'N' && !/[0-9]/.test(c)) n = c === '<' ? '0' : (TO_DIGIT[c] ?? c);
    else if (cls === 'A' && /[0-9]/.test(c)) n = TO_LETTER[c] ?? c;
    else if (cls === 'S' && !/[MFX<]/.test(c)) n = c === 'H' ? 'M' : c === 'P' ? 'F' : '<';
    if (n !== c) changes += 1;
    out += n;
  }
  return { text: out, changes };
}

const RANK: Record<MrzConfidence, number> = { checked: 2, partly: 1, unchecked: 0 };

function confidenceOf(mrz: MrzData): MrzConfidence {
  const three = mrz.documentNumber.valid !== false && mrz.birthDate.valid !== false && mrz.expiryDate.valid !== false;
  if (!three) return 'unchecked';
  return mrz.allValid ? 'checked' : 'partly';
}

/** positions (line index, offset) of the characters that are protected by a check digit and may be confused */
function ambiguous(format: MrzFormat, lines: string[]): Array<[number, number]> {
  const spans: Array<[number, number, number]> =
    format === 'TD1' ? [[0, 5, 14], [1, 0, 6], [1, 8, 14]] : [[1, 0, 9], [1, 13, 19], [1, 21, 27]];
  const out: Array<[number, number]> = [];
  for (const [l, from, to] of spans) for (let i = from; i < to; i += 1) if (CONFUSED[lines[l][i]]) out.push([l, i]);
  return out;
}

/** repairs a set of lines of one format; tries the alternatives of confusable characters (at most 2^8 combinations) until the check digits agree */
/** the fillers a real zone has at least (an ID card zone has about 25, a passport zone about 30); OCR may lose some, never most */
export const MIN_FILLERS = 6;

function tryFormat(format: MrzFormat, raw: string[]): MrzFromText | null {
  // ordinary words (the FRONT of a card: "NATIONALITY", "PERSONAL NO ...") have no filler: they are not a zone
  if (raw.join('').split('<').length - 1 < MIN_FILLERS) return null;
  const fitted = raw.map((l) => fit(l, LEN[format]));
  if (fitted.some((l) => l == null)) return null;
  let changes = 0;
  const lines = (fitted as string[]).map((l, i) => {
    const r = repairLine(l, CLASSES[format][i]);
    changes += r.changes;
    return r.text;
  });
  let best: { lines: string[]; mrz: MrzData; changes: number } | null = null;
  const consider = (candidate: string[], extra: number) => {
    const mrz = parseMrz(candidate);
    if (!mrz) return;
    const entry = { lines: candidate, mrz, changes: changes + extra };
    if (!best || RANK[confidenceOf(mrz)] > RANK[confidenceOf(best.mrz)] || (RANK[confidenceOf(mrz)] === RANK[confidenceOf(best.mrz)] && entry.changes < best.changes)) best = entry;
  };
  consider(lines, 0);
  if (best && confidenceOf((best as any).mrz) !== 'checked') {
    const spots = ambiguous(format, lines).slice(0, 8);
    const total = 1 << spots.length;
    for (let mask = 1; mask < total; mask += 1) {
      const candidate = lines.map((l) => l.split(''));
      let extra = 0;
      let skip = false;
      spots.forEach(([l, i], bit) => {
        if (!(mask & (1 << bit))) return;
        const alt = CONFUSED[lines[l][i]]?.[0];
        if (!alt) { skip = true; return; }
        // a digit-only position must stay a digit
        if (CLASSES[format][l][i] === 'N' && !/[0-9]/.test(alt)) { skip = true; return; }
        candidate[l][i] = alt;
        extra += 1;
      });
      if (!skip) consider(candidate.map((c) => c.join('')), extra);
      if (best && confidenceOf((best as any).mrz) === 'checked') break;
    }
  }
  if (!best) return null;
  const b = best as { lines: string[]; mrz: MrzData; changes: number };
  return { format, lines: b.lines, mrz: b.mrz, access: accessFromMrz(b.mrz), confidence: confidenceOf(b.mrz), changes: b.changes };
}

/** candidates for the format: runs of COUNT consecutive lines of about the right length, and the lines joined when the engine broke them elsewhere */
function runs(format: MrzFormat, lines: string[]): string[][] {
  const out: string[][] = [];
  const n = COUNT[format];
  const ok = lines.map((l) => Math.abs(l.length - LEN[format]) <= 4);
  for (let i = 0; i + n <= lines.length; i += 1) if (ok.slice(i, i + n).every(Boolean)) out.push(lines.slice(i, i + n));
  // the whole zone as one long string, or cut in other places
  const joined = lines.join('');
  const want = LEN[format] * n;
  if (!out.length && Math.abs(joined.length - want) <= 6) {
    const cut = joined.length < want ? joined.padEnd(want, '<') : joined.slice(0, want);
    out.push(Array.from({ length: n }, (_, k) => cut.slice(k * LEN[format], (k + 1) * LEN[format])));
  }
  return out;
}

export type ExpectedDocument = 'ID' | 'PASSPORT' | undefined;

/** the formats to try, the expected one first: an ID card is TD1 (or TD2), a passport TD3 */
export function formatsFor(expected: ExpectedDocument): MrzFormat[] {
  if (expected === 'ID') return ['TD1', 'TD2', 'TD3'];
  if (expected === 'PASSPORT') return ['TD3', 'TD2', 'TD1'];
  return ['TD3', 'TD1', 'TD2'];
}

/** the lines of OCR text (any number, any order of blocks is already fixed by the engine) -> the MRZ values; null when no zone was found */
export function mrzFromText(textLines: string[], expected?: ExpectedDocument): MrzFromText | null {
  const lines = textLines.flatMap((t) => t.split(/\r?\n/)).map(normalizeOcrLine).filter((l) => l.length >= 15);
  let best: MrzFromText | null = null;
  for (const format of formatsFor(expected)) {
    for (const candidate of runs(format, lines)) {
      const r = tryFormat(format, candidate);
      if (!r) continue;
      if (!best || RANK[r.confidence] > RANK[best.confidence] || (RANK[r.confidence] === RANK[best.confidence] && r.changes < best.changes)) best = r;
    }
    // a checked zone of the expected format wins at once
    if (best && best.confidence === 'checked') break;
  }
  return best;
}

export { checkDigit };
