// OrganizationTextsHost - mounted once in app/_layout.tsx: after the sign in it reads the texts of the active organization for the app language (organization_texts, ONE call) and hands them
// to kit8/i18n/organizationTexts.ts (pmT, t() and the column headers read them from there). Nothing is shown. Without Supabase or a signed-in user it does nothing.
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../../redux/activeUserSlice';
import { pmLanguage } from '../../../pm/i18n/pmT';
import { setOrganizationTexts } from '../../../i18n/organizationTexts';

export default function OrganizationTextsHost(): null {
  let client: any = null;
  try { client = useSupabase().supabase; } catch { client = null; }
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const language = pmLanguage();
  useEffect(() => {
    if (!client || !organizationGUID || typeof client.rpc !== 'function') { setOrganizationTexts([]); return undefined; }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await client.rpc('organization_texts', { p_language: language });
        if (!alive) return;
        setOrganizationTexts(error || !Array.isArray(data) ? [] : data);
      } catch {
        if (alive) setOrganizationTexts([]);
      }
    })();
    return () => { alive = false; };
  }, [client, organizationGUID, language]);
  return null;
}
