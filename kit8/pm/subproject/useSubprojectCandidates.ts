// useSubprojectCandidates - the list of the picker of a task (RPC subproject_candidates); read when the task window needs it.
import { useEffect, useState } from 'react';
import { useSupabase } from '../../providers/WithSupabase';
import { fetchSubprojectCandidates } from './subprojectApi';
import { PMSubprojectCandidate } from './subprojectModel';

export function useSubprojectCandidates(originProjectGUID: string | null | undefined, enabled: boolean) {
  const { supabase } = useSupabase();
  const [rows, setRows] = useState<PMSubprojectCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || !originProjectGUID) { setRows((r) => (r.length ? [] : r)); setError((e) => (e === null ? e : null)); return undefined; }
    let alive = true;
    setLoading(true);
    fetchSubprojectCandidates(supabase, originProjectGUID)
      .then((r) => { if (alive) { setRows(r); setError(null); } })
      .catch((e) => { if (alive) setError(e?.message || String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [supabase, originProjectGUID, enabled]);
  return { rows, error, isLoading };
}
