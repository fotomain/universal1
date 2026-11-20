// React side of the BIM import: the cloud adapter, the converter client and the project api made from the signed-in Supabase client; the caches are refreshed when it is done.
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { usePMStore } from '../../store/store_pm';
import { approvePM } from '../../inner/PMApproveYesNoCancelModalWindow';
import { errorMessage } from '../../crud/api/apiUtils';
import { pmKeys, usePMApi } from '../../crud/shared/queryShared';
import { createBimCloud } from '../cloud/bimCloud';
import { bimServerUrl, convertOnServer } from './bimServerClient';
import { runBimImport, type BimImportInput, type BimImportOutcome } from './runBimImport';

export type BimImportStatus = { kind: 'idle' } | { kind: 'busy'; percent: number; text: string } | { kind: 'done'; text: string; outcome: Extract<BimImportOutcome, { status: 'imported' }> } | { kind: 'error'; text: string } | { kind: 'cancelled' };

export function useBimImport(ownerGUID: string) {
  const api = usePMApi();
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [status, setStatus] = useState<BimImportStatus>({ kind: 'idle' });
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);

  const run = useCallback(
    async (input: Omit<BimImportInput, 'onStep'>): Promise<BimImportOutcome | null> => {
      setStatus({ kind: 'busy', percent: 0, text: 'Starting' });
      try {
        const out = await runBimImport(
          {
            cloud,
            api,
            ownerGUID,
            getProject: (g) => usePMStore.getState().projectsById[g],
            confirmReplace: (i) =>
              approvePM({
                title: `Replace the tasks of "${i.projectName}"?`,
                message: `The BIM project has ${i.tasks} tasks. They are DELETED and replaced by the tasks of the new model. This cannot be undone.`,
                yesLabel: 'Delete and import',
                destructive: true,
              }),
            convert: (params, source, onProgress) =>
              convertOnServer({ baseUrl: bimServerUrl(), getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null }, params, source, onProgress),
          },
          { ...input, onStep: (percent, text) => setStatus({ kind: 'busy', percent, text }) }
        );
        if (out.status === 'cancelled') {
          setStatus({ kind: 'cancelled' });
          return out;
        }
        await Promise.all([
          qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) }),
          qc.invalidateQueries({ queryKey: pmKeys.projectData(input.projectGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'closure'] }),
          qc.invalidateQueries({ queryKey: ['bim'] }),
        ]);
        setStatus({ kind: 'done', text: `Imported ${out.counts.elements} elements as ${out.plan.tasks.length} stages and tasks (revision ${out.revision}).`, outcome: out });
        return out;
      } catch (e) {
        setStatus({ kind: 'error', text: errorMessage(e) });
        return null;
      }
    },
    [api, cloud, ownerGUID, qc, supabase]
  );

  return { run, status, busy: status.kind === 'busy', cloud };
}
