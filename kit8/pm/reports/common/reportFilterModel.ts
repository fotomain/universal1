// reportFilterModel - the description of a filter bar as DATA (documentation/PARTNER_BALANCE.html section 7.1): a list of descriptors, the values are strings keyed by the descriptor id.
//   date      DateInputApp (8 digits or a picked day); an unreadable text is a red field and no filter
//   select    SelectItemFromListApp clearable; `clears` = the ids that are emptied when this one changes (the task depends on the project)
//   amount    a number (a minus sign and a decimal comma are fine); an unreadable text is a red field
//   period    the period button of Monitor01 (a range of months): it writes the two date ids named in `from` / `to`
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import { parseReportAmount } from './reportFormat';

export interface SelectItem { value: string; label: string }

export type FilterDescriptor =
  | { id: string; kind: 'date'; label: string; width?: number }
  | { id: string; kind: 'select'; label: string; items: readonly SelectItem[]; clears?: readonly string[]; width?: number; disabled?: boolean }
  | { id: string; kind: 'amount'; label: string; width?: number }
  | { id: string; kind: 'period'; from: string; to: string };

export type FilterValues = Record<string, string>;

/** the ids whose text cannot be read (a red field) */
export const reportFilterErrors = (descriptors: readonly FilterDescriptor[], values: FilterValues): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const d of descriptors) {
    const text = (values[d.id] ?? '').trim();
    if (d.kind === 'date') out[d.id] = !!text && parseDayInput(text) === null;
    else if (d.kind === 'amount') out[d.id] = parseReportAmount(text) === 'invalid';
  }
  return out;
};

/** a value change: the new value and the dependent ids emptied */
export const applyFilterChange = (descriptors: readonly FilterDescriptor[], values: FilterValues, id: string, value: string): FilterValues => {
  const d = descriptors.find((x) => x.id === id);
  const next: FilterValues = { ...values, [id]: value };
  if (d && d.kind === 'select') for (const dep of d.clears ?? []) next[dep] = '';
  return next;
};
