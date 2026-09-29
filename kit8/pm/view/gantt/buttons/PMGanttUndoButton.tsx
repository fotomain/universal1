// Undo (icon only + step counter). Asks first (PMApproveYesNoCancelModalWindow).

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';

export default function PMGanttUndoButton({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  const undoCount = usePMStore((s) => s.undoCount);
  const undoLabel = usePMStore((s) => s.undoLabel);
  return (
    <PMIconButton
      testID="pm-gantt-undo"
      icon="undo"
      badge={undoCount}
      title={undoLabel ? `Undo: ${undoLabel}  (Ctrl/⌘+Z)` : 'Nothing to undo'}
      color={palette.text}
      disabled={!undoCount || crud.isUndoing}
      onPress={crud.undoGanttAction}
    />
  );
}
