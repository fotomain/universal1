// Mounted by the project Actions button only while a function with an Actions item is on (C1 baselines, C5 status date): it owns the commands (usePMCrud) the items call.
import { useEffect } from 'react';
import { usePMStore } from '../../../store/store_pm';
import { usePMCrud } from '../../../crud/usePMCrud';
import { usePMOwnerGUID } from '../../../crud/queries';
import { extendedActionsNeeded, extendedCrudRef } from './useExtendedActions';

export default function PMExtendedActionsHost({ projectGUID }: { projectGUID: string | null | undefined }) {
  const needed = usePMStore((s) => extendedActionsNeeded(s.extFlags));
  if (!needed) return null;
  return <Inner projectGUID={projectGUID} />;
}

function Inner({ projectGUID }: { projectGUID: string | null | undefined }) {
  const owner = usePMOwnerGUID();
  const crud = usePMCrud(owner, projectGUID ?? null);
  useEffect(() => {
    extendedCrudRef.current = crud;
    return () => {
      if (extendedCrudRef.current === crud) extendedCrudRef.current = null;
    };
  }, [crud]);
  return null;
}
