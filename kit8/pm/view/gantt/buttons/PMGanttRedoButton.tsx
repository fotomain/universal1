// Redo (icon only + step counter), right after Undo on the Gantt bar: applies the last undone action again.
// Enabled only after an Undo; any new action empties it.
// Right-click / long touch: menu with "Clear redo history" - see PMGanttHistoryButton.

import React from 'react';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import PMGanttHistoryButton from './PMGanttHistoryButton';

export default function PMGanttRedoButton({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  return <PMGanttHistoryButton kind="redo" crud={crud} palette={palette} />;
}
