import React from 'react';
import PM80InfoModal from '../infoModal/PM80InfoModal';
import { kpiInfoContent, KpiId } from './kpiInfoModel';
import type { PM80MonthSnapshot } from '../pm80HomeModel';

export interface PM80KpiInfoModalProps {
  /** the KPI ring to describe; null = closed */
  id: KpiId | null;
  /** the numbers of the screen for the worked example */
  snapshot: PM80MonthSnapshot;
  onClose: () => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  testID?: string;
}

/** The description of one KPI ring for a CFO (a double touch / double click on its name): the content is kpiInfoContent(). */
export default function PM80KpiInfoModal({ id, snapshot, testID = 'pm80-kpi-info', ...rest }: PM80KpiInfoModalProps) {
  return <PM80InfoModal testID={testID} content={id ? kpiInfoContent(id, snapshot) : null} {...rest} />;
}
