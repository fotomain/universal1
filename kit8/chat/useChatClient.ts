// The Supabase client for the chat hooks. A screen or a test without the provider gets null (the chat calls then answer "Not connected." and nothing breaks).
import { useSupabase } from '../providers/WithSupabase';

export function useChatClient(): any {
  try {
    return (useSupabase() as any)?.supabase ?? null;
  } catch {
    return null;
  }
}
