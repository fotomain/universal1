// calculatorModel - the PURE part of the calculator (no React, no design system): the expression parser, the key handling (state machine), the number
// format of a language and the constraints of the field the result goes to. CalculatorApp.tsx draws it; calculatorModel.test.ts proves it.
//
// An expression is kept as plain text with the internal signs + - * / ( ) % and the decimal point '.'; the display turns it into x : - and the decimal
// separator of the user language (formatExpression).
// Percent works like the calculator of 1C / Windows: `200+10%` = 220 (10 % OF the left side), `200-10%` = 180, `200*10%` = 20 (plain /100).

export type CalcError = 'syntax' | 'divZero' | 'invalid';

export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.'
  | '+' | '-' | '*' | '/' | '(' | ')' | '%'
  | 'sqrt' | 'inv' | 'sign' | 'back' | 'clear' | 'equals'
  | 'mc' | 'mr' | 'mplus' | 'mminus';

export interface CalcState {
  /** the expression, internal signs */
  expr: string;
  /** the result of the last "=" (null before it) */
  result: number | null;
  /** the memory (M+ / M- / MR / MC); shared with the other calculators through calculatorStore */
  memory: number;
  /** true right after "=" / a function key / a start with a value: the next DIGIT starts a new number, an operator continues with the value */
  fresh: boolean;
  error: CalcError | null;
}

export type EvalResult = { ok: true; value: number } | { ok: false; error: CalcError };

const isDigit = (c: string | undefined) => !!c && c >= '0' && c <= '9';
const isOperator = (c: string | undefined) => c === '+' || c === '-' || c === '*' || c === '/';

/** 0.1 + 0.2 = 0.3: a result keeps 12 significant digits */
export function roundCalc(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Number(n.toPrecision(12));
}

// ---------------------------------------------------------------- evaluate

interface Tok { t: 'num' | 'op' | 'lp' | 'rp' | 'pct'; v?: number; op?: string }

function tokenize(text: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (isDigit(c) || c === '.') {
      let j = i;
      let dots = 0;
      while (j < text.length && (isDigit(text[j]) || text[j] === '.')) { if (text[j] === '.') dots++; j++; }
      if (dots > 1) return null;
      const n = Number(text.slice(i, j));
      if (!Number.isFinite(n)) return null;
      out.push({ t: 'num', v: n });
      i = j;
    } else if (isOperator(c)) { out.push({ t: 'op', op: c }); i++; }
    else if (c === '(') { out.push({ t: 'lp' }); i++; }
    else if (c === ')') { out.push({ t: 'rp' }); i++; }
    else if (c === '%') { out.push({ t: 'pct' }); i++; }
    else if (c === ' ') i++;
    else return null;
  }
  return out;
}

/** evaluates an expression: + - * / ( ) %, a unary minus / plus, a missing ")" at the end is closed, a trailing operator is ignored */
export function evaluateExpression(text: string): EvalResult {
  const toks = tokenize(text);
  if (!toks) return { ok: false, error: 'syntax' };
  while (toks.length && toks[toks.length - 1].t === 'op') toks.pop();
  if (!toks.length) return { ok: false, error: 'syntax' };
  let depth = 0;
  for (const k of toks) { if (k.t === 'lp') depth++; else if (k.t === 'rp') depth--; if (depth < 0) return { ok: false, error: 'syntax' }; }
  for (; depth > 0; depth--) toks.push({ t: 'rp' });

  let pos = 0;
  let fail: CalcError | null = null;
  const peek = () => toks[pos];
  // factor = [+|-] (number | "(" expr ")") ["%"]; pct = the factor carries a percent sign
  const factor = (): { v: number; pct: boolean } => {
    const k = peek();
    if (k && k.t === 'op' && (k.op === '-' || k.op === '+')) { pos++; const f = factor(); return { v: k.op === '-' ? -f.v : f.v, pct: f.pct }; }
    let v = 0;
    if (k && k.t === 'num') { pos++; v = k.v as number; }
    else if (k && k.t === 'lp') { pos++; v = expr(); if (peek()?.t === 'rp') pos++; else fail = fail ?? 'syntax'; }
    else { fail = fail ?? 'syntax'; return { v: 0, pct: false }; }
    let pct = false;
    while (peek()?.t === 'pct') { pos++; v = v / 100; pct = true; }
    return { v, pct };
  };
  const term = (): { v: number; lone: boolean; pct: boolean } => {
    const first = factor();
    let v = first.v;
    let lone = true;
    while (peek()?.t === 'op' && (peek().op === '*' || peek().op === '/')) {
      const op = toks[pos++].op;
      const f = factor();
      lone = false;
      if (op === '*') v = v * f.v;
      else if (f.v === 0) { fail = fail ?? 'divZero'; v = 0; }
      else v = v / f.v;
    }
    return { v, lone, pct: first.pct };
  };
  const expr = (): number => {
    let v = term().v;
    while (peek()?.t === 'op' && (peek().op === '+' || peek().op === '-')) {
      const op = toks[pos++].op;
      const r = term();
      // "200 + 10%" = 200 + 10 % of 200
      const right = r.lone && r.pct ? v * r.v : r.v;
      v = op === '+' ? v + right : v - right;
    }
    return v;
  };
  const value = expr();
  if (!fail && pos < toks.length) fail = 'syntax';
  if (fail) return { ok: false, error: fail };
  if (!Number.isFinite(value)) return { ok: false, error: 'invalid' };
  return { ok: true, value: roundCalc(value) };
}

// ---------------------------------------------------------------- format

/** the decimal separator of a language: the comma for most European languages, the point for English, Chinese, Hindi, Bengali, Arabic, Farsi (digits stay 0-9) */
export function decimalSeparatorFor(language: string | undefined): '.' | ',' {
  const code = String(language ?? 'en').toLowerCase().split('-')[0];
  return ['es', 'fr', 'pt', 'ru', 'de', 'nl', 'lv', 'lt', 'et'].includes(code) ? ',' : '.';
}

/** a number as the calculator shows it: 12 significant digits, no exponent unless it is huge / tiny, the decimal separator of the language */
export function formatCalcNumber(n: number, separator: '.' | ',' = '.'): string {
  if (!Number.isFinite(n)) return '';
  const r = roundCalc(n);
  const abs = Math.abs(r);
  let s: string;
  if (r === 0) s = '0';
  else if (abs >= 1e15 || abs < 1e-9) s = r.toExponential();
  else s = String(r);
  return separator === ',' ? s.replace('.', ',') : s;
}

/** the expression as the display writes it: x : − and the decimal separator of the language */
export function formatExpression(expr: string, separator: '.' | ',' = '.'): string {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, separator);
}

// ---------------------------------------------------------------- state

export function calcInitialState(value?: number | string | null, memory = 0): CalcState {
  const n = value === null || value === undefined || value === '' ? null : Number(String(value).replace(',', '.'));
  const has = n !== null && Number.isFinite(n);
  return { expr: has ? numberToExpr(n as number) : '', result: null, memory, fresh: has, error: null };
}

/** a number written into an expression: no exponent, a negative number in brackets when it is not the first */
function numberToExpr(n: number): string {
  const r = roundCalc(n);
  const abs = Math.abs(r);
  const s = abs >= 1e15 || (abs !== 0 && abs < 1e-9) ? r.toExponential() : String(r);
  return s.includes('e') ? String(Number(r.toFixed(12))) : s;
}

/** the value of the expression now: null while the expression is empty or wrong */
export function calcValue(state: CalcState): number | null {
  if (!state.expr) return null;
  const r = evaluateExpression(state.expr);
  return r.ok ? r.value : null;
}

/** the last number written in the expression (digits and the point), '' when the expression does not end with one */
function trailingNumber(expr: string): string {
  const m = /[0-9.]+$/.exec(expr);
  return m ? m[0] : '';
}

function openParens(expr: string): number {
  let d = 0;
  for (const c of expr) { if (c === '(') d++; else if (c === ')') d--; }
  return d;
}

function withValue(state: CalcState, value: number): CalcState {
  const v = roundCalc(value);
  return { ...state, expr: numberToExpr(v), result: v, fresh: true, error: null };
}

export function calcPress(state: CalcState, key: CalcKey): CalcState {
  const s: CalcState = { ...state, error: null };
  const last = s.expr[s.expr.length - 1];

  if (isDigit(key)) {
    if (s.fresh) return { ...s, expr: key, fresh: false };
    const tail = trailingNumber(s.expr);
    if (tail === '0') return { ...s, expr: s.expr.slice(0, -1) + key };       // 0 then 5 = 5, not 05
    if (last === ')' || last === '%') return { ...s, expr: s.expr + '*' + key };
    return { ...s, expr: s.expr + key };
  }
  switch (key) {
    case '.': {
      if (s.fresh) return { ...s, expr: '0.', fresh: false };
      const tail = trailingNumber(s.expr);
      if (tail.includes('.')) return s;
      if (!tail) return { ...s, expr: s.expr + (last === ')' || last === '%' ? '*0.' : '0.') };
      return { ...s, expr: s.expr + '.' };
    }
    case '+': case '-': case '*': case '/': {
      if (!s.expr) return { ...s, expr: key === '-' ? '-' : '0' + key, fresh: false };
      if (last === '(') return key === '-' ? { ...s, expr: s.expr + '-', fresh: false } : s;
      if (s.expr === '-') return s;
      if (isOperator(last)) {
        const before = s.expr[s.expr.length - 2];
        const head = before !== undefined && isOperator(before) ? s.expr.slice(0, -2) : s.expr.slice(0, -1);
        return { ...s, expr: head + key, fresh: false };
      }
      return { ...s, expr: s.expr + key, fresh: false };
    }
    case '(': {
      if (s.fresh && !isOperator(last)) return { ...s, expr: '(', fresh: false };
      if (isDigit(last) || last === ')' || last === '%' || last === '.') return { ...s, expr: s.expr + '*(', fresh: false };
      return { ...s, expr: s.expr + '(', fresh: false };
    }
    case ')': {
      if (openParens(s.expr) <= 0) return s;
      if (!(isDigit(last) || last === ')' || last === '%')) return s;
      return { ...s, expr: s.expr + ')', fresh: false };
    }
    case '%': {
      if (!(isDigit(last) || last === ')')) return s;
      return { ...s, expr: s.expr + '%', fresh: false };
    }
    case 'back': return { ...s, expr: s.expr.slice(0, -1), result: null, fresh: false };
    case 'clear': return { ...s, expr: '', result: null, fresh: false };
    case 'equals': {
      if (!s.expr) return s;
      const r = evaluateExpression(s.expr);
      return r.ok ? withValue(s, r.value) : { ...s, error: r.error };
    }
    case 'sqrt': case 'inv': case 'sign': {
      const r = s.expr ? evaluateExpression(s.expr) : ({ ok: true, value: 0 } as EvalResult);
      if (!r.ok) return { ...s, error: r.error };
      if (key === 'sqrt') return r.value < 0 ? { ...s, error: 'invalid' } : withValue(s, Math.sqrt(r.value));
      if (key === 'inv') return r.value === 0 ? { ...s, error: 'divZero' } : withValue(s, 1 / r.value);
      return withValue(s, -r.value);
    }
    case 'mc': return { ...s, memory: 0 };
    case 'mr': {
      const m = numberToExpr(s.memory);
      const text = s.memory < 0 ? '(' + m + ')' : m;
      if (s.fresh || !s.expr) return { ...s, expr: text, fresh: false };
      const tail = trailingNumber(s.expr);
      if (tail) return { ...s, expr: s.expr.slice(0, -tail.length) + text, fresh: false };
      return { ...s, expr: s.expr + (last === ')' || last === '%' ? '*' : '') + text, fresh: false };
    }
    case 'mplus': case 'mminus': {
      const r = s.expr ? evaluateExpression(s.expr) : ({ ok: true, value: 0 } as EvalResult);
      if (!r.ok) return { ...s, error: r.error };
      const memory = roundCalc(s.memory + (key === 'mplus' ? r.value : -r.value));
      return { ...withValue(s, r.value), memory };
    }
  }
  return s;
}

// ---------------------------------------------------------------- result into a field

export interface CalcConstraints { integer?: boolean; min?: number; max?: number }

/** the result as the field takes it: an integer field rounds, min / max are kept (the same limits as the number cell) */
export function applyConstraints(n: number, c: CalcConstraints = {}): number {
  let v = c.integer ? Math.round(n) : n;
  if (c.min !== undefined && v < c.min) v = c.min;
  if (c.max !== undefined && v > c.max) v = c.max;
  return v;
}

export type CalcOkResult = { kind: 'value'; value: number } | { kind: 'empty' } | { kind: 'error'; error: CalcError };

/** what the OK button does: the value of the expression with the field limits, nothing for an empty calculator, the error for a wrong expression */
export function calcOk(state: CalcState, c: CalcConstraints = {}): CalcOkResult {
  if (!state.expr) return { kind: 'empty' };
  const r = evaluateExpression(state.expr);
  return r.ok ? { kind: 'value', value: applyConstraints(r.value, c) } : { kind: 'error', error: r.error };
}

/** a keyboard key (web) -> the calculator key; null = not a calculator key */
export function calcKeyFromKeyboard(key: string): CalcKey | null {
  if (key.length === 1 && isDigit(key)) return key as CalcKey;
  switch (key) {
    case '.': case ',': return '.';
    case '+': case '-': case '*': case '/': case '(': case ')': case '%': return key;
    case 'x': case 'X': return '*';
    case ':': return '/';
    case '=': return 'equals';
    case 'Backspace': return 'back';
    case 'Delete': return 'clear';
    default: return null;
  }
}
