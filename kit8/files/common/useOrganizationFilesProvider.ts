// The storage of the files of the signed-in user's organization (organizationTable.rowJSON.organizationFilesStorageProvider), read ONCE with a plain
// select: no React Query, no provider needed (a screen or a test without Supabase / a signed-in user gets Google Drive and never throws).
// The database decides where a file really goes (files_authorize -> provider); this only tells the Files panel which storage to show.
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSupabase } from '../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../redux/activeUserSlice';
import { filesProviderOfOrganization, type FileStorageProvider } from './fileModel';

function useClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}

export function useOrganizationFilesProvider(): FileStorageProvider {
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const client = useClient();
  const [provider, setProvider] = useState<FileStorageProvider>('googleDrive');
  useEffect(() => {
    if (!organizationGUID || !client?.from) return undefined;
    let alive = true;
    try {
      Promise.resolve(client.from('organizationTable').select('rowJSON').eq('rowGUID', organizationGUID).maybeSingle())
        .then((r: any) => { if (alive && r?.data) setProvider(filesProviderOfOrganization(r.data.rowJSON)); })
        .catch(() => undefined);
    } catch {
      // a client that cannot read: Google Drive stays
    }
    return () => { alive = false; };
  }, [organizationGUID, client]);
  return provider;
}
