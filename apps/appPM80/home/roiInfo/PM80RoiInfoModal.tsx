import React from 'react';
import PM80InfoModal from '../infoModal/PM80InfoModal';
import { roiInfoContent, RoiInfoNumbers } from './roiInfoModel';
import type { RoiKindKey } from '../pm80HomeModel';

export interface PM80RoiInfoModalProps {
  /** the ROI to describe; null = closed */
  kind: RoiKindKey | null;
  /** the worked example (the numbers of the screen), null while closed */
  numbers: RoiInfoNumbers | null;
  onClose: () => void;
  isDark: boolean;
  textStrong: string;
  textMuted: string;
  accent: string;
  borderColor: string;
  testID?: string;
}

/** The description of one ROI for a CFO (a double touch on a ROI button of the home): the content is roiInfoContent(). */
export default function PM80RoiInfoModal({ kind, numbers, testID = 'pm80-roi-info', ...rest }: PM80RoiInfoModalProps) {
  return <PM80InfoModal testID={testID} content={kind && numbers ? roiInfoContent(kind, numbers) : null} {...rest} />;
}
