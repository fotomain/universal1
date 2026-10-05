// Gantt bar: "custom period" icon button, right before "Today". Opens PMGanttPeriodModalWindow;
// highlighted while a custom period is set (store.ganttPeriod).

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { formatDateISO } from '../../project/scheduling';
import { DAY_MS } from '../../../model/constants';

export default function PMGanttPeriodButton({ palette }: { palette: PMPalette }) {
  const period = usePMStore((s) => s.ganttPeriod);
  const title = period
    ? `Custom period ${formatDateISO(period.startMs)} – ${formatDateISO(period.finishMs - DAY_MS)} · change it`
    : 'Set a custom period (from – to) for the chart';
  return (
    <PMIconButton
      testID="pm-gantt-period"
      icon="date_range"
      title={title}
      color={palette.text}
      active={!!period}
      activeColor={palette.primary}
      onPress={() => usePMStore.getState().setGanttPeriodOpen(true)}
    />
  );
}
