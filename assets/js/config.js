// Konfigurasi publik Supabase (aman untuk browser: hanya publishable/anon key).
// JANGAN pernah menaruh secret key, service_role key, atau password database di sini.
//
// Cara mengisi:
//   1. Salin assets/js/config.local.example.js menjadi assets/js/config.local.js
//   2. Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY dari Supabase Dashboard
//      (Project Settings → API).
//   3. config.local.js sudah masuk .gitignore sehingga kredensial tidak ikut ter-commit.

const rawConfig = window.FINANCE_APP_CONFIG ?? {};

export const SUPABASE_URL = String(rawConfig.SUPABASE_URL ?? '').trim();
export const SUPABASE_PUBLISHABLE_KEY = String(rawConfig.SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export const isSupabaseConfigured =
  /^https?:\/\//.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('your_');
