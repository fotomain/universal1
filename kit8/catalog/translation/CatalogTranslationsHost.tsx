// CatalogTranslationsHost - mounted once in app/_layout.tsx: after the sign in it reads the catalog translations of the INTERFACE language (catalogTranslationTable, rowParentGUID =
// the language, paged) and hands them to catalogTranslationStore; a change of the language re-reads, and a realtime change of the table re-reads (debounced). Nothing is shown.
// Without Supabase or a signed-in user it does nothing (the store is emptied).
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSupabase } from '../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../redux/activeUserSlice';
import { usePMLanguage } from '../../pm/i18n/pmT';
import { readAllPages } from '../../pm/crud/api/apiUtils';
import { setCatalogTranslations } from './catalogTranslationStore';

const REREAD_MS = 400;

export default function CatalogTranslationsHost(): null {
  let client: any = null;
  try { client = useSupabase().supabase; } catch { client = null; }
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const language = usePMLanguage();
  useEffect(() => {
    if (!client || !organizationGUID || typeof client.from !== 'function') { setCatalogTranslations(language, []); return undefined; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = async () => {
      try {
        const rows = await readAllPages((from, to) => client.from('catalogTranslationTable').select('rowOwnerGUID, rowParentGUID, rowJSON').eq('rowParentGUID', language)
          .order('rowOwnerGUID', { ascending: true }).order('rowGUID', { ascending: true }).range(from, to));
        if (alive) setCatalogTranslations(language, rows);
      } catch {
        if (alive) setCatalogTranslations(language, []);
      }
    };
    void read();
    let channel: any = null;
    try {
      if (typeof client.channel === 'function') {
        channel = client.channel(`catalog-translations-${language}`);
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'catalogTranslationTable' }, () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { void read(); }, REREAD_MS);
        });
        channel.subscribe?.();
      }
    } catch {
      // realtime is optional: the next language change / reload reads again
    }
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      try { if (channel) client.removeChannel?.(channel); } catch { /* ignore */ }
    };
  }, [client, organizationGUID, language]);
  return null;
}
