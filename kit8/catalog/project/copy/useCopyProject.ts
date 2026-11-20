// useCopyProject: the React side of projectCopy.ts - used by the card menu of /catalog/project.
//   copy(sourceProject, withTasks, withBim?) -> makes the copy, refreshes the project list, tells the result in a snackbar (errors in the error window)
// One copy at a time (busy); the copy is NOT selected / opened - it appears in the list right behind its source.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { showErrorModal } from '../../../ui/components/common/ErrorModalWindow';
import { errorMessage } from '../../../pm/crud/api/apiUtils';
import { pmKeys, usePMApi } from '../../../pm/crud/shared/queryShared';
import { pmT } from '../../../pm/i18n/pmT';
import { PMProjectRow } from '../../../pm/model/types';
import { useSupabase } from '../../../providers/WithSupabase';
import { createBimCloud } from '../../../pm/bim/cloud/bimCloud';
import { copyBimModel } from '../../../pm/bim/copy/copyBimModel';
import { usePMStore } from '../../../pm/store/store_pm';
import { copyOrderAfter, copyProject, copyProjectName } from './projectCopy';

export function useCopyProject(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const { supabase } = useSupabase();
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const qc = useQueryClient();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const copy = useCallback(
    async (source: PMProjectRow, withTasks: boolean, withBim = false) => {
      if (!ownerGUID || running.current) return null;
      running.current = true;
      setBusy(true);
      try {
        const s = usePMStore.getState();
        const projects = s.projectOrder.map((g) => s.projectsById[g]).filter(Boolean);
        const name = copyProjectName(source.rowJSON?.name || '', projects.map((p) => p.rowJSON?.name || ''));
        const orderInList = copyOrderAfter(Number(source.orderInList) || 0, projects.map((p) => Number(p.orderInList) || 0));
        const r = await copyProject(api, source, ownerGUID, { withTasks, name, orderInList, withBim, copyBim: (s, t, idMap) => copyBimModel(cloud, s, t, idMap) });
        await qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
        const bim = withBim && r.bimElements ? `, ${pmT('{{n}} BIM element(s)', { n: r.bimElements })}` : '';
        const detail = withTasks || withBim ? ` (${pmT('{{n}} task(s)', { n: r.tasks })}${bim})` : '';
        dispatch(showSnackbar({ message: `${pmT('Project copied')}: ${name}${detail}`, isError: false }));
        return r;
      } catch (e) {
        showErrorModal(errorMessage(e), pmT('Copy project'));
        return null;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [api, cloud, qc, dispatch, ownerGUID]
  );

  return { copy, busy };
}
