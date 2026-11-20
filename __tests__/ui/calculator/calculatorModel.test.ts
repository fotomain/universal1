// calculatorModel: the parser (percent like 1C / Windows), the key handling, the number format of a language and the limits of the field.
import {
  applyConstraints, calcInitialState, calcKeyFromKeyboard, calcOk, calcPress, calcValue, decimalSeparatorFor, evaluateExpression, formatCalcNumber, formatExpression,
} from '../../../kit8/ui/components/calculator/calculatorModel';
import type { CalcKey, CalcState } from '../../../kit8/ui/components/calculator/calculatorModel';

const keys = (start: CalcState, seq: string[]): CalcState => seq.reduce((s, k) => calcPress(s, k as CalcKey), start);
const type = (text: string, start: CalcState = calcInitialState()) => keys(start, text.split(''));
const val = (text: string) => { const r = evaluateExpression(text); return r.ok ? r.value : r.error; };

describe('evaluateExpression', () => {
  it('+ - * / with the usual priority and brackets', () => {
    expect(val('2+3*4')).toBe(14);
    expect(val('(2+3)*4')).toBe(20);
    expect(val('10/4')).toBe(2.5);
    expect(val('-5+8')).toBe(3);
    expect(val('2*-3')).toBe(-6);
  });
  it('0.1 + 0.2 = 0.3 (12 significant digits)', () => {
    expect(val('0.1+0.2')).toBe(0.3);
    expect(val('1/3*3')).toBe(1);
  });
  it('percent: of the left side after + and -, plain /100 after * and /', () => {
    expect(val('200+10%')).toBe(220);
    expect(val('200-10%')).toBe(180);
    expect(val('200*10%')).toBe(20);
    expect(val('50%')).toBe(0.5);
    expect(val('200/50%')).toBe(400);
  });
  it('a trailing operator is ignored, a missing ) is closed', () => {
    expect(val('5+')).toBe(5);
    expect(val('(2+3')).toBe(5);
  });
  it('errors: division by zero, syntax', () => {
    expect(val('5/0')).toBe('divZero');
    expect(val('')).toBe('syntax');
    expect(val('2)')).toBe('syntax');
    expect(val('1.2.3+1')).toBe('syntax');
    expect(val('()')).toBe('syntax');
  });
});

describe('calcPress', () => {
  it('digits and operators build the expression; = gives the result which can be continued', () => {
    let s = type('12+30');
    expect(s.expr).toBe('12+30');
    s = calcPress(s, 'equals');
    expect(s.expr).toBe('42');
    expect(s.result).toBe(42);
    s = calcPress(s, '*');                     // continues with the result
    s = type('2', s);
    expect(calcValue(calcPress(s, 'equals'))).toBe(84);
  });
  it('after = a digit starts a new number', () => {
    expect(calcPress(type('2+2'), 'equals').fresh).toBe(true);
    expect(calcPress(calcPress(type('2+2'), 'equals'), '7').expr).toBe('7');
  });
  it('the value of the field is the start: a digit replaces it, an operator continues it', () => {
    const s = calcInitialState(12.5);
    expect(s.expr).toBe('12.5');
    expect(calcPress(s, '7').expr).toBe('7');
    expect(calcPress(s, '*').expr).toBe('12.5*');
  });
  it('no 05, one point per number, a leading point is 0.', () => {
    expect(keys(calcInitialState(), ['0', '5']).expr).toBe('5');
    expect(keys(calcInitialState(), ['1', '.', '5', '.']).expr).toBe('1.5');
    expect(keys(calcInitialState(), ['.', '5']).expr).toBe('0.5');
    expect(keys(calcInitialState(), ['5', '+', '.']).expr).toBe('5+0.');
  });
  it('an operator replaces the one before it; a first operator makes 0 + / minus', () => {
    expect(keys(calcInitialState(), ['5', '+', '*']).expr).toBe('5*');
    expect(keys(calcInitialState(), ['*']).expr).toBe('0*');
    expect(keys(calcInitialState(), ['-', '5']).expr).toBe('-5');
  });
  it('brackets: ) only when one is open; a number before ( means times', () => {
    expect(keys(calcInitialState(), [')']).expr).toBe('');
    expect(keys(calcInitialState(), ['2', '(', '3', ')']).expr).toBe('2*(3)');
    expect(keys(calcInitialState(), ['(', '2', '+', '3', ')', '*', '4', 'equals']).expr).toBe('20');
  });
  it('back removes one character, clear everything but the memory', () => {
    expect(keys(calcInitialState(), ['1', '2', 'back']).expr).toBe('1');
    const s = keys(calcInitialState(undefined, 7), ['1', '2', 'clear']);
    expect(s.expr).toBe('');
    expect(s.memory).toBe(7);
  });
  it('sqrt, 1/x, sign work on the value of the expression', () => {
    expect(calcPress(type('16'), 'sqrt').expr).toBe('4');
    expect(calcPress(type('4'), 'inv').expr).toBe('0.25');
    expect(calcPress(type('5'), 'sign').expr).toBe('-5');
    expect(calcPress(calcPress(type('5'), 'sign'), 'sign').expr).toBe('5');
    expect(calcPress(type('2+2'), 'sqrt').expr).toBe('2');
  });
  it('errors do not destroy the expression: 1/0, sqrt of a negative', () => {
    const a = calcPress(type('0'), 'inv');
    expect(a.error).toBe('divZero');
    expect(a.expr).toBe('0');
    expect(calcPress(type('-4'), 'sqrt').error).toBe('invalid');
    expect(calcPress(type('5/0'), 'equals').error).toBe('divZero');
  });
  it('memory: M+ M- MR MC', () => {
    let s = type('5');
    s = calcPress(s, 'mplus');
    expect(s.memory).toBe(5);
    s = calcPress(type('2', s), 'mminus');
    expect(s.memory).toBe(3);
    s = calcPress(calcPress(s, 'clear'), 'mr');
    expect(s.expr).toBe('3');
    expect(calcPress(type('4+', calcPress(s, 'clear')), 'mr').expr).toBe('4+3');
    expect(calcPress(s, 'mc').memory).toBe(0);
    expect(calcPress(calcInitialState(undefined, -2), 'mr').expr).toBe('(-2)');
  });
  it('percent only after a number', () => {
    expect(calcPress(calcInitialState(), '%').expr).toBe('');
    expect(type('200+10%').expr).toBe('200+10%');
    expect(calcValue(type('200+10%'))).toBe(220);
  });
});

describe('format and language', () => {
  it('decimal separator by language', () => {
    expect(decimalSeparatorFor('en')).toBe('.');
    expect(decimalSeparatorFor('ru')).toBe(',');
    expect(decimalSeparatorFor('de-AT')).toBe(',');
    expect(decimalSeparatorFor('zh')).toBe('.');
    expect(decimalSeparatorFor(undefined)).toBe('.');
  });
  it('numbers and expressions as shown', () => {
    expect(formatCalcNumber(1234.5, ',')).toBe('1234,5');
    expect(formatCalcNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatCalcNumber(1e21)).toBe('1e+21');
    expect(formatCalcNumber(NaN)).toBe('');
    expect(formatExpression('12.5*3-1/2', ',')).toBe('12,5×3−1÷2');
  });
});

describe('result into a field', () => {
  it('applyConstraints: integer rounds, min / max clamp', () => {
    expect(applyConstraints(7.5, { integer: true })).toBe(8);
    expect(applyConstraints(-3, { min: 0 })).toBe(0);
    expect(applyConstraints(99, { max: 10 })).toBe(10);
  });
  it('calcOk: value / empty / error', () => {
    expect(calcOk(type('2+3'))).toEqual({ kind: 'value', value: 5 });
    expect(calcOk(type('2-9'), { min: 0 })).toEqual({ kind: 'value', value: 0 });
    expect(calcOk(calcInitialState())).toEqual({ kind: 'empty' });
    expect(calcOk(type('5/0'))).toEqual({ kind: 'error', error: 'divZero' });
  });
});

describe('keyboard', () => {
  it('maps keys', () => {
    expect(calcKeyFromKeyboard('7')).toBe('7');
    expect(calcKeyFromKeyboard(',')).toBe('.');
    expect(calcKeyFromKeyboard('x')).toBe('*');
    expect(calcKeyFromKeyboard('Backspace')).toBe('back');
    expect(calcKeyFromKeyboard('=')).toBe('equals');
    expect(calcKeyFromKeyboard('q')).toBeNull();
  });
});
