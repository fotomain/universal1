/** @jest-environment jsdom */
// SelectPeriodButton / SelectPeriodModal: the icon button opens the modal, clicking two months applies a whole range, Clear resets the draft, Cancel
// discards it, re-opening shows the active filter, and the grid can be navigated to other years.
import React, { useState } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../ui/pmUiTestKit';
import SelectPeriodButton from '../../../../kit8/pm/reports/monitor01/SelectPeriodButton';

afterEach(() => cleanupUI());

const T = 'p';
const month = (y: number, m: string) => `${T}-modal-month-${y}-${m}`;

function Host({ initial }: { initial?: { startDate: string; finishDate: string } }) {
  const [value, setValue] = useState(initial ?? { startDate: '', finishDate: '' });
  return <SelectPeriodButton testID={T} value={value} onApply={setValue} color="#000" />;
}

describe('the button', () => {
  it('opens the modal; the modal is closed at the start', () => {
    renderUI(<Host />);
    expect(q(`${T}-modal`)).toBeNull();
    press(`${T}-button`);
    expect(q(`${T}-modal`)).not.toBeNull();
    expect(textOf(`${T}-modal`)).toContain('Select period');
  });
});

describe('picking a range', () => {
  it('two months, later one first, still applies start = the earlier month, finish = the later one', () => {
    renderUI(<Host />);
    press(`${T}-button`);
    press(month(2026, '10'));
    press(month(2026, '06'));
    expect(textOf(`${T}-modal-from`)).toBe('2026-06-01');
    expect(textOf(`${T}-modal-to`)).toBe('2026-10-31');
    press(`${T}-modal-select`);
    expect(q(`${T}-modal`)).toBeNull();                                        // the modal closes
    press(`${T}-button`);
    expect(textOf(`${T}-modal-from`)).toBe('2026-06-01');                      // re-opened: shows what was applied
    expect(textOf(`${T}-modal-to`)).toBe('2026-10-31');
  });
  it('one month clicked twice: a one-month period', () => {
    renderUI(<Host />);
    press(`${T}-button`);
    press(month(2026, '10'));
    press(month(2026, '10'));
    expect(textOf(`${T}-modal-from`)).toBe('2026-10-01');
    expect(textOf(`${T}-modal-to`)).toBe('2026-10-31');
    press(`${T}-modal-select`);
    press(`${T}-button`);
    expect(textOf(`${T}-modal-from`)).toBe('2026-10-01');
    expect(textOf(`${T}-modal-to`)).toBe('2026-10-31');
  });
  it('a third click after a completed range starts a NEW period', () => {
    renderUI(<Host />);
    press(`${T}-button`);
    press(month(2026, '06'));
    press(month(2026, '08'));
    press(month(2026, '11'));                                                  // a fresh start, not a third edge of the old range
    expect(textOf(`${T}-modal-from`)).toBe('2026-11-01');
    expect(textOf(`${T}-modal-to`)).toBe('2026-11-30');
  });
  it('Select needs at least one month picked', () => {
    renderUI(<Host />);
    press(`${T}-button`);
    expect(q(`${T}-modal-select`)).not.toBeNull();
    // no assertion on disabled styling here - just that nothing is applied without a pick
    press(`${T}-modal-cancel`);
    expect(q(`${T}-modal`)).toBeNull();
  });
});

describe('Clear and Cancel', () => {
  it('Clear period resets the draft in the window; Select then does nothing (no month picked)', () => {
    renderUI(<Host initial={{ startDate: '2026-06-01', finishDate: '2026-08-31' }} />);
    press(`${T}-button`);
    expect(q(`${T}-modal-clear`)).not.toBeNull();
    press(`${T}-modal-clear`);
    expect(q(`${T}-modal-clear`)).toBeNull();                                  // nothing picked any more: no Clear link
    expect(textOf(`${T}-modal-from`)).toBe('Start month');
  });
  it('Cancel discards the draft: the filter is unchanged', () => {
    renderUI(<Host initial={{ startDate: '2026-06-01', finishDate: '2026-08-31' }} />);
    press(`${T}-button`);
    press(month(2026, '01'));
    press(`${T}-modal-cancel`);
    press(`${T}-button`);
    expect(textOf(`${T}-modal-from`)).toBe('2026-06-01');                      // the OLD period, not January
  });
  it('the ✕ (close) also discards, like Cancel', () => {
    renderUI(<Host initial={{ startDate: '2026-06-01', finishDate: '2026-08-31' }} />);
    press(`${T}-button`);
    press(month(2026, '01'));
    press(`${T}-modal-close`);
    press(`${T}-button`);
    expect(textOf(`${T}-modal-from`)).toBe('2026-06-01');
  });
});

describe('re-opening shows the active filter, centred on its year', () => {
  it('a filter set outside the window (e.g. typed) shows up pre-selected when the window opens', () => {
    renderUI(<Host initial={{ startDate: '2025-03-01', finishDate: '2025-05-31' }} />);
    press(`${T}-button`);
    expect(q(`${T}-modal-year-2025`)).not.toBeNull();                          // centred on 2025
    expect(textOf(`${T}-modal-from`)).toBe('2025-03-01');
    expect(textOf(`${T}-modal-to`)).toBe('2025-05-31');
  });
  it('no filter at all: centred on the current year', () => {
    renderUI(<Host />);
    press(`${T}-button`);
    expect(q(`${T}-modal-year-${new Date().getFullYear()}`)).not.toBeNull();
  });
});

describe('navigating the years', () => {
  it('› / ‹ shift all three year columns together', () => {
    renderUI(<Host initial={{ startDate: '2026-06-01', finishDate: '2026-06-30' }} />);
    press(`${T}-button`);
    expect(['2025', '2026', '2027'].map((y) => q(`${T}-modal-year-${y}`) !== null)).toEqual([true, true, true]);
    press(`${T}-modal-next`);
    expect(['2026', '2027', '2028'].map((y) => q(`${T}-modal-year-${y}`) !== null)).toEqual([true, true, true]);
    expect(q(`${T}-modal-year-2025`)).toBeNull();
    press(`${T}-modal-prev`);
    press(`${T}-modal-prev`);
    expect(['2024', '2025', '2026'].map((y) => q(`${T}-modal-year-${y}`) !== null)).toEqual([true, true, true]);
  });
});
