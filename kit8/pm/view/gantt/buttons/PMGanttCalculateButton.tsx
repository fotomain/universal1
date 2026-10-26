// "Calculate" of the Gantt bar (MS Project: Project > Calculation Options > Calculate Project, F9) - shown only while the project is in MANUAL calculation mode
// (Extended A2: the option "Calculation: Manual" in the Extended window). The label says how many edits the plan does not contain yet; F9 does the same on the web.
// documentation/MORE_GANTT_ProjectCalculationAutomaticOrManual.html
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { pendingCountOfState } from '../../../store/storeDerive';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttCalculateButton({ palette }: { palette: PMPalette }) {
  const manual = usePMStore((s) => s.calculationMode === 'manual');
  const pending = usePMStore((s) => pendingCountOfState(s));
  const calculate = usePMStore((s) => s.calculateProject);

  useEffect(() => {
    if (!manual || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        usePMStore.getState().calculateProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [manual]);

  if (!manual) return null;
  return (
    <PMIconButton
      testID="pm-gantt-calculate"
      icon="calculate"
      label={pending > 0 ? pmT('Not calculated · {{n}}', { n: pending }) : pmT('Calculate')}
      title={pmT('Calculate the project (F9): the dates of the other tasks follow your edits only now')}
      color={pending > 0 ? '#c2410c' : palette.text}
      onPress={calculate}
    />
  );
}
