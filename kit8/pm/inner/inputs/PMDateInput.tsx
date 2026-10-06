// Date field of the PM module = kit8/components/common/date_input/DateInputApp (calendar icon inside at the left,
// clear icon inside at the right) wired to the PM dates: UTC days, typed / shown in the project's
// planDateInputFormat (YYYY-MM-DD is always accepted too).

import React, { useCallback } from 'react';
import DateInputApp, { DateInputAppProps } from '../../../components/common/date_input/DateInputApp';
import { localDateToUtcDay, utcDayToLocalDate } from '../../../components/common/date_input/dateInputFormat';
import { formatPlanDate, parsePlanDate, PMPlanDateInputFormat } from '../../model/types';
import { formatDateISO, parseDateISO } from '../../view/project/scheduling';
import { pmT } from '../../i18n/pmT';

/** only the calendar formats can be written by the picker; the time formats fall back to YYYY-MM-DD */
const DAY_FORMATS: PMPlanDateInputFormat[] = ['DD MMM', 'DD.MM.YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

export interface PMDateInputProps extends Omit<DateInputAppProps, 'parse' | 'format'> {
  /** project date format (default YYYY-MM-DD) */
  dateFormat?: PMPlanDateInputFormat;
}

export function PMDateInput({ dateFormat = 'YYYY-MM-DD', placeholder, style, compact, ...rest }: PMDateInputProps) {
  const fmt = DAY_FORMATS.includes(dateFormat) ? dateFormat : 'YYYY-MM-DD';
  const parse = useCallback(
    (text: string) => {
      const ms = parseDateISO(text.trim()) ?? parsePlanDate(text, fmt);
      return ms === null || ms === undefined ? null : utcDayToLocalDate(ms);
    },
    [fmt]
  );
  const format = useCallback((d: Date) => (fmt === 'YYYY-MM-DD' ? formatDateISO(localDateToUtcDay(d)) : formatPlanDate(localDateToUtcDay(d), fmt)), [fmt]);
  return (
    <DateInputApp
      compact={compact ?? false}
      placeholder={placeholder ?? fmt}
      pickerLabel={pmT('Select date')}
      clearLabel={pmT('Clear')}
      {...rest}
      parse={parse}
      format={format}
      style={style}
    />
  );
}

export { PMDateInput as DateInputApp };
export default PMDateInput;
