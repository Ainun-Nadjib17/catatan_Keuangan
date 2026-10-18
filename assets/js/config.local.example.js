// Salin file ini menjadi assets/js/config.local.js, lalu isi nilai aslinya.
// File config.local.js tidak di-commit ke git.
//
// Nilai diambil dari Supabase Dashboard → Project Settings → API:
//   - Project URL
//   - Publishable key (atau anon public key pada project lama)
//
// Publishable/anon key memang dirancang untuk dipakai di browser. Jangan pernah
// memakai secret key atau service_role key di file ini.

window.FINANCE_APP_CONFIG = {
  SUPABASE_URL: 'https://eaufrssijfqjqjxbklrd.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_nkqoCjUqLlmx-UjAg-216Q_e_jZH14i',
};
