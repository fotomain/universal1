// usePaymentFactPlaces - the project and task NAMES of the lines of a payment fact (a line has only their GUIDs): one read of project_table and project_task_table for the GUIDs the lines name.
// Returns a map line GUID → LinePlace (the same shape the multi project invoices use, so LinePlaceCell shows it).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import type { LinePlace } from '../../vendor/lineplace/linePlaceModel';

type Row = { rowGUID: string; rowProjectGUID?: string; rowOwnerGUID?: string };

export function usePaymentFactPlaces(rows: Row[]): Record<string, LinePlace> {
  const { supabase } = useSupabase();
  const tasks = useMemo(() => [...new Set(rows.map((r) => String(r.rowOwnerGUID ?? '')).filter(Boolean))].sort(), [rows]);
  const projects = useMemo(() => [...new Set(rows.map((r) => String(r.rowProjectGUID ?? '')).filter(Boolean))].sort(), [rows]);
  const q = useQuery({
    queryKey: ['pm', 'paymentFactPlaces', tasks.join(','), projects.join(',')],
    enabled: tasks.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const [t, p] = await Promise.all([
        (supabase as any).from('project_task_table').select('rowGUID,rowJSON').in('rowGUID', tasks),
        (supabase as any).from('project_table').select('rowGUID,rowJSON').in('rowGUID', projects),
      ]);
      const taskName = new Map<string, string>((t.data ?? []).map((x: any) => [String(x.rowGUID), String(x.rowJSON?.taskDescription ?? '')]));
      const projectName = new Map<string, string>((p.data ?? []).map((x: any) => [String(x.rowGUID), String(x.rowJSON?.name ?? x.rowJSON?.title ?? '')]));
      return { taskName, projectName };
    },
  });
  return useMemo(() => {
    const out: Record<string, LinePlace> = {};
    for (const r of rows) {
      const task = String(r.rowOwnerGUID ?? '');
      const project = String(r.rowProjectGUID ?? '');
      out[String(r.rowGUID)] = { projectGUID: project, projectName: q.data?.projectName.get(project) ?? '', taskGUID: task, taskName: q.data?.taskName.get(task) ?? '', taskLineGUID: null };
    }
    return out;
  }, [rows, q.data]);
}
