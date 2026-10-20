// PMNumberInputApp - the number input of the lines of a project task (task_line_table) and of the lines of every document (fact input, purchase order,
// product receipt, vendor invoice, customer invoice): free typing, saved on blur / Enter (only when the value really changed), optional - / + buttons.
// positiveOnly (default true): no minus sign can be typed and the saved number is never below 0 (a `min` above 0 still wins).
// tableName / tableFieldName say WHERE the input is used (the table and the field it edits). They change nothing in the behavior: they are written on the
// input (web: data-tablename / data-tablefieldname) so that a place can be found in the code text and in the page.
// Use it in a ReusableTable column with `...pmNumberColumn(tableName, tableFieldName)` (pmNumberColumn.tsx).
import React from 'react';
import { NumberCell } from '../../ui/components/table/reusable/ReusableTableCell';

export interface PMNumberInputAppProps {
  /** the table of the line, e.g. 'task_line_table', 'vendor_invoice_lines' (information only) */
  tableName: string;
  /** the field of the table the input edits, e.g. 'qtyTaskLine', 'priceInvoiced' (information only) */
  tableFieldName: string;
  /** default true: only numbers from 0 up */
  positiveOnly?: boolean;
  value?: number | string | null;
  /** the number typed / stepped to (null = emptied); called only when it really changed */
  onCommit: (n: number | null) => void;
  editable?: boolean;
  /** digits only (default false: decimals allowed) */
  integer?: boolean;
  min?: number;
  max?: number;
  /** - / + buttons (default false) */
  stepper?: boolean;
  step?: number;
  placeholder?: string;
  align?: 'left' | 'center' | 'right';
  /** cell look, from the table (uxuiTable): corner radius, border width, height */
  radius?: number;
  border?: number;
  h?: number;
  testID?: string;
}

/** the lowest number the input accepts: 0 for positiveOnly, never below the min the caller gave */
export function pmNumberMin(positiveOnly: boolean, min?: number): number | undefined {
  if (!positiveOnly) return min;
  return min === undefined ? 0 : Math.max(min, 0);
}

export default function PMNumberInputApp({
  tableName, tableFieldName, positiveOnly = true, value, onCommit, editable = true, integer = false, min, max, stepper = false, step, placeholder,
  align, radius = 0, border = 0, h = 40, testID = `pm-number-${tableName}-${tableFieldName}`,
}: PMNumberInputAppProps) {
  return (
    <NumberCell
      testID={testID}
      dataSet={{ tablename: tableName, tablefieldname: tableFieldName }}
      value={value}
      editable={editable}
      integer={integer}
      min={pmNumberMin(positiveOnly, min)}
      max={max}
      stepper={stepper}
      step={step}
      placeholder={placeholder}
      align={align ?? (stepper ? 'center' : 'right')}
      radius={radius}
      border={border}
      h={h}
      onCommit={onCommit}
    />
  );
}
