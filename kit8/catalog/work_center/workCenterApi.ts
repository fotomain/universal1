// Work center - the one call that is not a ReusableTable cell: "Copy Variant settings" (SQL work_center_copy_variant_settings, PART 35).
// the Supabase client is loaded when a call is made, so importing this file (a screen, a test) never creates the client
const client = async () => (await import('../../supabase/supabase')).supabase;
import { RPC_COPY_WORK_CENTER_VARIANT } from './workCenterModel';

/**
 * The work center gets ITS OWN variant: a one-time copy of the base variant it has chosen (the variant row and its descriptor values). Returns the rowGUID of the new variant.
 * When the work center has a variant already the server refuses unless `overwrite` is true - the screen asks the user first.
 */
export async function copyWorkCenterVariantSettings(workCenterGUID: string, overwrite = false): Promise<string> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(RPC_COPY_WORK_CENTER_VARIANT, { p_work_center: workCenterGUID, p_overwrite: overwrite });
  if (error) throw new Error(error.message || String(error));
  return String(data ?? '');
}
