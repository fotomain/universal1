/** @jest-environment jsdom */
// PMNumberInputApp: positive numbers only, saved on blur / Enter, tableName / tableFieldName on the input; and every editable number column of the
// task lines and of the document lines uses it (pmNumberColumn).
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: {} }) }));

import PMNumberInputApp, { pmNumberMin } from '../../../kit8/pm/components/PMNumberInputApp';
import { pmNumberColumn } from '../../../kit8/pm/components/pmNumberColumn';

let root: any;
let host: HTMLElement;
const input = () => host.querySelector('input') as HTMLInputElement;
const mount = (el: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
};
const type = (text: string) => act(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input(), text);
  input().dispatchEvent(new Event('input', { bubbles: true }));
});
const blur = () => act(() => { input().focus(); input().blur(); });
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

describe('pmNumberMin', () => {
  it('positiveOnly never goes below 0, a bigger min wins, off = the caller min', () => {
    expect(pmNumberMin(true)).toBe(0);
    expect(pmNumberMin(true, -5)).toBe(0);
    expect(pmNumberMin(true, 3)).toBe(3);
    expect(pmNumberMin(false)).toBeUndefined();
    expect(pmNumberMin(false, -5)).toBe(-5);
  });
});

describe('PMNumberInputApp', () => {
  it('carries tableName / tableFieldName and a minus cannot be typed (positiveOnly is the default)', () => {
    const onCommit = jest.fn();
    mount(<PMNumberInputApp tableName="task_line_table" tableFieldName="qtyTaskLine" value={2} onCommit={onCommit} testID="n" />);
    expect(input().getAttribute('data-tablename')).toBe('task_line_table');
    expect(input().getAttribute('data-tablefieldname')).toBe('qtyTaskLine');
    type('-7.5');
    expect(input().value).toBe('7.5');
    blur();
    expect(onCommit).toHaveBeenCalledWith(7.5);
  });

  it('positiveOnly={false} allows a minus sign', () => {
    const onCommit = jest.fn();
    mount(<PMNumberInputApp tableName="t" tableFieldName="f" positiveOnly={false} value={null} onCommit={onCommit} />);
    type('-3');
    blur();
    expect(onCommit).toHaveBeenCalledWith(-3);
  });

  it('saves only when the value changed, and an emptied input saves null', () => {
    const onCommit = jest.fn();
    mount(<PMNumberInputApp tableName="t" tableFieldName="f" value={4} onCommit={onCommit} />);
    blur();
    expect(onCommit).not.toHaveBeenCalled();
    type('');
    blur();
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('is plain text when not editable', () => {
    mount(<PMNumberInputApp tableName="t" tableFieldName="f" value={9} editable={false} onCommit={jest.fn()} />);
    expect(host.querySelector('input')).toBeNull();
    expect(host.textContent).toBe('9');
  });
});

describe('pmNumberColumn', () => {
  it('renders PMNumberInputApp with the table and the field', () => {
    const { renderNumber } = pmNumberColumn('vendor_invoice_lines', 'qtyInvoiced');
    mount(<>{renderNumber({ testID: 'c', value: 1, editable: true, integer: false, min: 0, max: 10, stepper: false, align: 'right', radius: 0, border: 0, h: 40, onCommit: jest.fn() })}</>);
    expect(input().getAttribute('data-tablename')).toBe('vendor_invoice_lines');
    expect(input().getAttribute('data-tablefieldname')).toBe('qtyInvoiced');
  });
});

describe('the lines of the tasks and of the documents use it', () => {
  const root0 = path.resolve(__dirname, '../../../kit8');
  const files = [
    'pm/view/task/finances/taskLineColumns.tsx',
    'documents/fact/input/factColumns.tsx',
    'documents/vendor/purchase_order/purchaseOrderColumns.tsx',
    'documents/vendor/product_receipt/productReceiptColumns.tsx',
    'documents/vendor/invoice/vendorInvoiceColumns.tsx',
    'documents/customer/invoice/customerInvoiceColumns.tsx',
  ];
  it.each(files)('%s: every editable number column (qty, price, VAT %) has pmNumberColumn', (file) => {
    const lines = fs.readFileSync(path.join(root0, file), 'utf8').split('\n').filter((l) => /type: 'number'/.test(l) && /min: 0/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const l of lines) expect(l).toContain('pmNumberColumn(');
  });
});
