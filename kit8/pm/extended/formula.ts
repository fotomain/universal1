// F5 Custom fields: formulas (pure, NO eval). A formula column is calculated for every row from the other fields of the row.
//   [Field]            a field of the row: [Name] [WBS] [Duration] [% Complete] [Start] [Finish] [Priority] [Work] [Units] [Slack] or another custom column by its name
//   numbers, "text", + - * /  & (join text)  comparisons > < >= <= = <>   ( )
//   IF(test; then; else) ROUND(x; digits) ABS(x) MIN(a; b ...) MAX(a; b ...) LEN(text) UPPER(text) LOWER(text) AND(a; b ...) OR(a; b ...) NOT(x)
// [Start] and [Finish] are DAY numbers (days since 1970), so [Finish]-[Start] is a number of days; an empty field is 0 in a calculation and "" as text.
// A formula with an error gives an empty cell (never an exception).
export type PMFormulaValue = number | string | boolean | null;

type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'field'; v: string } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[') { const j = src.indexOf(']', i); if (j < 0) throw new Error('missing ]'); out.push({ t: 'field', v: src.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); if (j < 0) throw new Error('missing "'); out.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    const n = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (n) { out.push({ t: 'num', v: Number(n[0]) }); i += n[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ t: 'id', v: id[0].toUpperCase() }); i += id[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '<>', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/&()<>=;,'.includes(c)) { out.push({ t: 'op', v: c === ',' ? ';' : c }); i++; continue; }
    throw new Error(`unexpected "${c}"`);
  }
  return out;
}

const num = (v: PMFormulaValue): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : v === null || v === '' ? 0 : Number(v) || 0);
const text = (v: PMFormulaValue): string => (v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v));
const truthy = (v: PMFormulaValue): boolean => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v !== null && v !== '' && v.toLowerCase() !== 'false');

/** the value of a formula for one row; null = an error or an empty result */
export function evalFormula(formula: string, field: (name: string) => PMFormulaValue): PMFormulaValue {
  try {
    const toks = tokenize(formula);
    let p = 0;
    const peek = () => toks[p];
    const eat = (v?: string) => { const t = toks[p]; if (!t || (v !== undefined && !(t.t === 'op' && t.v === v))) throw new Error(`expected ${v ?? 'a value'}`); p++; return t; };
    const isOp = (v: string) => peek()?.t === 'op' && (peek() as any).v === v;

    const parseOr = (): PMFormulaValue => { let l = parseAnd(); while (isOp('||')) { p++; const r = parseAnd(); l = truthy(l) || truthy(r); } return l; };
    const parseAnd = (): PMFormulaValue => { let l = parseCmp(); while (isOp('&&')) { p++; const r = parseCmp(); l = truthy(l) && truthy(r); } return l; };
    const parseCmp = (): PMFormulaValue => {
      let l = parseConcat();
      for (;;) {
        const t = peek();
        if (!(t && t.t === 'op' && ['>', '<', '>=', '<=', '=', '<>'].includes(t.v))) return l;
        p++;
        const r = parseConcat();
        const both = typeof l === 'string' && typeof r === 'string';
        const a = both ? (l as string).toLowerCase() : num(l);
        const b = both ? (r as string).toLowerCase() : num(r);
        l = t.v === '>' ? a > b : t.v === '<' ? a < b : t.v === '>=' ? a >= b : t.v === '<=' ? a <= b : t.v === '=' ? a === b : a !== b;
      }
    };
    const parseConcat = (): PMFormulaValue => { let l = parseAdd(); while (isOp('&')) { p++; l = text(l) + text(parseAdd()); } return l; };
    const parseAdd = (): PMFormulaValue => {
      let l = parseMul();
      for (;;) {
        if (isOp('+')) { p++; l = num(l) + num(parseMul()); } else if (isOp('-')) { p++; l = num(l) - num(parseMul()); } else return l;
      }
    };
    const parseMul = (): PMFormulaValue => {
      let l = parseUnary();
      for (;;) {
        if (isOp('*')) { p++; l = num(l) * num(parseUnary()); } else if (isOp('/')) { p++; const d = num(parseUnary()); l = d === 0 ? null : num(l) / d; } else return l;
      }
    };
    const parseUnary = (): PMFormulaValue => { if (isOp('-')) { p++; return -num(parseUnary()); } return parsePrimary(); };
    const parseArgs = (): PMFormulaValue[] => {
      const args: PMFormulaValue[] = [];
      eat('(');
      if (!isOp(')')) for (;;) { args.push(parseOr()); if (isOp(';')) { p++; continue; } break; }
      eat(')');
      return args;
    };
    const parsePrimary = (): PMFormulaValue => {
      const t = peek();
      if (!t) throw new Error('unexpected end');
      if (t.t === 'num') { p++; return t.v; }
      if (t.t === 'str') { p++; return t.v; }
      if (t.t === 'field') { p++; return field(t.v); }
      if (t.t === 'op' && t.v === '(') { p++; const v = parseOr(); eat(')'); return v; }
      if (t.t === 'id') {
        p++;
        if (t.v === 'TRUE') return true;
        if (t.v === 'FALSE') return false;
        const a = parseArgs();
        switch (t.v) {
          case 'IF': return truthy(a[0] ?? false) ? a[1] ?? null : a[2] ?? null;
          case 'ROUND': { const k = Math.pow(10, Math.max(0, Math.min(8, Math.round(num(a[1] ?? 0))))); return Math.round(num(a[0] ?? 0) * k) / k; }
          case 'ABS': return Math.abs(num(a[0] ?? 0));
          case 'MIN': return a.length ? Math.min(...a.map(num)) : null;
          case 'MAX': return a.length ? Math.max(...a.map(num)) : null;
          case 'LEN': return text(a[0] ?? '').length;
          case 'UPPER': return text(a[0] ?? '').toUpperCase();
          case 'LOWER': return text(a[0] ?? '').toLowerCase();
          case 'AND': return a.every(truthy);
          case 'OR': return a.some(truthy);
          case 'NOT': return !truthy(a[0] ?? false);
          default: throw new Error(`unknown function ${t.v}`);
        }
      }
      throw new Error('unexpected token');
    };
    const v = parseOr();
    if (p < toks.length) throw new Error('unexpected token');
    return typeof v === 'number' && !Number.isFinite(v) ? null : v;
  } catch {
    return null;
  }
}

/** null = the formula is valid; else the problem (for the editor) */
export function formulaError(formula: string): string | null {
  try {
    tokenize(formula);
  } catch (e: any) {
    return e?.message ?? 'error';
  }
  // evaluate once with empty fields: a syntax error returns null for ANY input, a runtime null is not distinguishable, so check the syntax with a probe that yields numbers
  let ok = true;
  const probe = evalFormula(formula, () => 1);
  if (probe === null && !/\/\s*(\[|\d)/.test(formula) && formula.trim() !== '') ok = false;
  return ok ? null : 'the formula cannot be calculated';
}
