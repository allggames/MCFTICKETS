import { createClient } from '@supabase/supabase-js';

// La clave publicable está diseñada para el navegador. Nunca incluir secretos
// de Supabase (sb_secret_*) ni service_role en este archivo o en Vite.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
