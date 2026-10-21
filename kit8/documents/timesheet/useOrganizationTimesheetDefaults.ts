// The Organization's rowJSON for the Person level of TabTimesheet (the inherited values). One row read by its GUID, the cache of useMyOrganization is reused (same query key and shape).
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useSupabase } from '../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../redux/activeUserSlice';
import { organizationTable } from '../../catalog/organization/organizationModel';

export function useOrganizationTimesheetDefaults(): Record<string, any> | null {
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  let client: any = null;
  try { client = useSupabase().supabase; } catch { client = null; }
  const q = useQuery({
    queryKey: ['organization-row', organizationGUID],
    enabled: !!organizationGUID && !!client,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await client.from(organizationTable).select('rowGUID,rowJSON').eq('rowGUID', organizationGUID).maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });
  return (q.data as any)?.rowJSON ?? null;
}
