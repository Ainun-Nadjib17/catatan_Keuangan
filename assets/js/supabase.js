import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  isSupabaseConfigured,
} from './config.js';

let client = null;

/**
 * Client Supabase dibuat lazy supaya halaman bisa menampilkan pesan setup
 * yang ramah ketika config.local.js belum diisi.
 */
export function getClient() {
  if (!isSupabaseConfigured) return null;

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }

  return client;
}

export { isSupabaseConfigured };
