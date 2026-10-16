// useMonitor01SubprojectKind - what Monitor01 needs for the radio Projects | Subprojects | All:
//   show             the radio is shown only when a project of the organization has subprojectsFunctionalityEnabled (RPC organization_has_subprojects_enabled)
//   subprojectGUIDs  the projects that are the subproject of at least one task (table project_subproject_link)
// Read when the report opens and on `reload()` (the Refresh button); `enabled` = false (the one-project mode): nothing is read.
import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '../../providers/WithSupabase';
import { fetchOrganizationHasSubprojects, fetchSubprojectGUIDs } from './subprojectApi';

const NONE: ReadonlySet<string> = new Set();

export function useMonitor01SubprojectKind(enabled: boolean) {
  const { supabase } = useSupabase();
  const [show, setShow] = useState(false);
  const [subprojectGUIDs, setGUIDs] = useState<ReadonlySet<string>>(NONE);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    if (!enabled) { setShow(false); setGUIDs(NONE); return undefined; }
    let alive = true;
    (async () => {
      try {
        const on = await fetchOrganizationHasSubprojects(supabase);
        const guids = on ? await fetchSubprojectGUIDs(supabase) : NONE;
        if (alive) { setShow(on); setGUIDs(guids); }
      } catch {
        if (alive) { setShow(false); setGUIDs(NONE); }      // without the answer the report is exactly as before (no radio, no filter)
      }
    })();
    return () => { alive = false; };
  }, [supabase, enabled, nonce]);
  return { show, subprojectGUIDs, reload };
}
