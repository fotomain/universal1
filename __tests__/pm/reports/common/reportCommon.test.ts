// The shared pieces of the money reports (kit8/pm/reports/common): the number format, the amount text, the filter descriptors (errors, dependent clearing).
import { formatReportMoney, parseReportAmount } from '../../../../kit8/pm/reports/common/reportFormat';
import { FilterDescriptor, applyFilterChange, reportFilterErrors } from '../../../../kit8/pm/reports/common/reportFilterModel';

describe('formatReportMoney', () => {
  it('two decimals, groups of three, a minus sign', () => {
    expect(formatReportMoney(0)).toBe('0.00');
    expect(formatReportMoney(1234.5)).toBe('1 234.50');
    expect(formatReportMoney(-1234567.891)).toBe('-1 234 567.89');
    expect(formatReportMoney(-0.004)).toBe('0.00');
    expect(formatReportMoney(NaN)).toBe('0.00');
  });
});

describe('parseReportAmount', () => {
  it('empty = no filter, a comma is a decimal point, spaces are ignored, a minus is fine', () => {
    expect(parseReportAmount('')).toBeNull();
    expect(parseReportAmount('   ')).toBeNull();
    expect(parseReportAmount(undefined)).toBeNull();
    expect(parseReportAmount('12,5')).toBe(12.5);
    expect(parseReportAmount('1 000')).toBe(1000);
    expect(parseReportAmount('-30')).toBe(-30);
  });
  it('anything else is invalid', () => {
    for (const t of ['abc', '1.2.3', '--1', '1e5', '12,', '+5']) expect(parseReportAmount(t)).toBe('invalid');
  });
});

const D: FilterDescriptor[] = [
  { id: 'from', kind: 'date', label: 'dateFrom' },
  { id: 'project', kind: 'select', label: 'Project', items: [], clears: ['task'] },
  { id: 'task', kind: 'select', label: 'Task', items: [] },
  { id: 'big', kind: 'amount', label: 'Sum bigger than' },
  { id: 'p', kind: 'period', from: 'from', to: 'to' },
];
describe('the filter descriptors', () => {
  it('an unreadable date or amount is an error; the others are not', () => {
    expect(reportFilterErrors(D, { from: '2026-13-45', big: 'x', project: '', task: '' })).toEqual({ from: true, big: true });
    expect(reportFilterErrors(D, { from: '20260101', big: '-5,5' })).toEqual({ from: false, big: false });
    expect(reportFilterErrors(D, { from: '', big: '' })).toEqual({ from: false, big: false });
  });
  it('a change empties the dependent ids (the task depends on the project)', () => {
    expect(applyFilterChange(D, { project: 'p1', task: 't1', from: '' }, 'project', 'p2')).toEqual({ project: 'p2', task: '', from: '' });
    expect(applyFilterChange(D, { project: 'p1', task: 't1' }, 'task', 't2')).toEqual({ project: 'p1', task: 't2' });
  });
});
