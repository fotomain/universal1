// Time scale presets: Day · Week · Month · Year (the active one follows the current zoom).

import React from 'react';
import { PMScaleUnit, PM_ZOOM_PRESETS } from '../ganttGeometry';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../inner/buttons/PMIconButton';

const SCALES: { key: keyof typeof PM_ZOOM_PRESETS; unit: PMScaleUnit; icon: string; label: string; title?: string }[] = [
  { key: 'day', unit: 'day', icon: 'calendar_view_day', label: 'Day' },
  { key: 'week', unit: 'week', icon: 'calendar_view_week', label: 'Week' },
  { key: 'month', unit: 'month', icon: 'calendar_month', label: 'Month' },
  { key: 'year', unit: 'quarter', icon: 'date_range', label: 'Year', title: 'Year (quarters)' },
];

export default function PMGanttScaleButtons({
  palette,
  activeUnit,
  onZoom,
}: {
  palette: PMPalette;
  /** bottom unit of the current scale (scaleLevelsFor(dayWidth).bottom) */
  activeUnit: PMScaleUnit;
  onZoom: (dayWidth: number) => void;
}) {
  return (
    <>
      {SCALES.map((s) => (
        <PMIconButton
          key={s.key}
          testID={`pm-gantt-scale-${s.key}`}
          icon={s.icon}
          label={s.label}
          title={s.title}
          active={activeUnit === s.unit}
          activeColor={palette.primary}
          color={palette.text}
          onPress={() => onZoom(PM_ZOOM_PRESETS[s.key])}
        />
      ))}
    </>
  );
}
