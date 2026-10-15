// The Supabase client for the cost safety net after a Post, or null when there is no SupabaseProvider (screens and tests that render the Post hooks without one must keep working:
// the cost update is optional, a Post is not). useSupabase() throws AFTER its useContext, so the hook order stays the same on every render.
import { useSupabase } from '../../providers/WithSupabase';

export function useCostClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}
