// Undo (icon only + step counter). Asks first (PMApproveYesNoCancelModalWindow).
// Right-click / long touch: menu with "Clear undo history" - see PMGanttHistoryButton.

import React from 'react';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import PMGanttHistoryButton from './PMGanttHistoryButton';

export default function PMGanttUndoButton({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  return <PMGanttHistoryButton kind="undo" crud={crud} palette={palette} />;
}
