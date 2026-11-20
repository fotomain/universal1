// identification-recognize (Supabase Edge Function, Deno). Deploy it yourself:
//   supabase functions deploy identification-recognize
//   supabase secrets set GOOGLE_AI_API_KEY="$(grep '^GOOGLE_AI_API_KEY=' .env | cut -d= -f2-)"      (the same name as in the .env of the app)
//   supabase secrets set GOOGLE_AI_MODEL=gemini-flash-lite-latest          (optional: another Gemini model id)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase to every function. The logic is handler.ts (tested in Jest); README.md says what is sent where.
// @ts-nocheck - Deno globals and URL imports are not known to the app's TypeScript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { handleRecognize } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const apiKey = Deno.env.get('GOOGLE_AI_API_KEY') || '';
const model = Deno.env.get('GOOGLE_AI_MODEL') || undefined;

Deno.serve((req: Request) =>
  handleRecognize(req, {
    apiKey,
    model,
    caller: async (authorization) => {
      const sb = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
      const { data, error } = await sb.auth.getUser();
      return error ? null : (data?.user?.id ?? null);
    },
  }),
);
