/** @jest-environment jsdom */
// DateInputApp: eight digits typed without separators become the normal date text at once - 20260101 (YYYYMMDD) and 20122026 (DDMMYYYY = 20 Dec 2026).
import React, { useState } from 'react';
import { cleanupUI, inputValue, renderUI, typeInto } from '../pm/ui/pmUiTestKit';
import DateInputApp from '../../kit8/ui/components/common/date_input/DateInputApp';
import { defaultParseDateInput, parseCompactDateDigits } from '../../kit8/ui/components/common/date_input/dateInputFormat';
import { parseDayInput } from '../../kit8/pm/fact/factInputModel';

afterEach(() => cleanupUI());

describe('parseCompactDateDigits', () => {
  it('YYYYMMDD and DDMMYYYY', () => {
    expect(parseCompactDateDigits('20260101')).toEqual({ y: 2026, m: 1, d: 1 });
    expect(parseCompactDateDigits('20122026')).toEqual({ y: 2026, m: 12, d: 20 });
    expect(parseCompactDateDigits('31122026')).toEqual({ y: 2026, m: 12, d: 31 });
    expect(parseCompactDateDigits('20261231')).toEqual({ y: 2026, m: 12, d: 31 });
  });
  it('YYYYMMDD wins when both read as a day; a real day of a plausible year only', () => {
    expect(parseCompactDateDigits('20121010')).toEqual({ y: 2012, m: 10, d: 10 });
    expect(parseCompactDateDigits('20260230')).toBeNull();            // 30 Feb; as DDMMYYYY: day 20, month 26
    expect(parseCompactDateDigits('99999999')).toBeNull();
    expect(parseCompactDateDigits('2026010')).toBeNull();             // seven digits
    expect(parseCompactDateDigits('202601011')).toBeNull();
    expect(parseCompactDateDigits('2026-01-01')).toBeNull();
  });
  it('defaultParseDateInput and parseDayInput read them', () => {
    expect(defaultParseDateInput('20260101')!.getMonth()).toBe(0);
    expect(defaultParseDateInput('20122026')!.getDate()).toBe(20);
    expect(parseDayInput('20260101')).toBe('2026-01-01');
    expect(parseDayInput('20122026')).toBe('2026-12-20');
    expect(parseDayInput('2026-01-01')).toBe('2026-01-01');
    expect(parseDayInput('14.10.2026')).toBe('2026-10-14');
    expect(parseDayInput('20260230')).toBeNull();
  });
});

describe('the field', () => {
  const picked: (Date | null)[] = [];
  function Host() {
    const [t, setT] = useState('');
    return <DateInputApp testID="d" value={t} onChangeText={setT} onSelectDate={(d) => picked.push(d)} />;
  }
  beforeEach(() => { picked.length = 0; });

  it('20260101 becomes 2026-01-01 (and the day is "picked")', () => {
    renderUI(<Host />);
    typeInto('d', '20260101');
    expect(inputValue('d')).toBe('2026-01-01');
    expect(picked).toHaveLength(1);
    expect(picked[0]!.getFullYear()).toBe(2026);
  });
  it('20122026 becomes 2026-12-20', () => {
    renderUI(<Host />);
    typeInto('d', '20122026');
    expect(inputValue('d')).toBe('2026-12-20');
  });
  it('typing on: fewer digits, a not-a-day number and other forms are left as typed', () => {
    renderUI(<Host />);
    typeInto('d', '2026010');
    expect(inputValue('d')).toBe('2026010');
    typeInto('d', '20260230');
    expect(inputValue('d')).toBe('20260230');
    typeInto('d', '14.10.2026');
    expect(inputValue('d')).toBe('14.10.2026');
    expect(picked).toHaveLength(0);
  });
});
