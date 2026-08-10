import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { useSupabase } from '../providers/WithSupabase';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  'https://czgrxgzdmodkkmbmraub.supabase.co';

const supabaseAnonKey =
  process.env.EXPO_ANON_SUPABASE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Z3J4Z3pkbW9ka2ttYm1yYXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1OTU3MzYsImV4cCI6MjA3NzE3MTczNn0.4aul_NOjMO_VEKOgxFE3-Z5plqH1g8aSN8xJEgHPYR8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { useSupabase };