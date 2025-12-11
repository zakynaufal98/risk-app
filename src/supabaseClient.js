// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file.'
  );
}

/**
 * NOTE:
 * - persistSession: true  -> Supabase akan menyimpan session (access + refresh token) di storage (localStorage by default)
 * - autoRefreshToken: true -> Supabase akan mencoba refresh access token otomatis bila refresh token masih valid
 *
 * Ubah nilai ini sesuai kebijakan keamanan Anda.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // jika Anda ingin custom storage (mis. wrapper around localStorage), dapat diberikan di sini:
    // storage: window.localStorage
  }
});

/**
 * Utility untuk membersihkan key terkait Supabase di localStorage.
 * Gunakan ini ketika Anda perlu memastikan seluruh token/kunci lokal dihapus.
 */
export function clearLocalAuthKeys() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      const kl = String(k).toLowerCase();
      if (kl.includes('supabase') || kl.startsWith('sb-')) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    // ignore
    console.warn('clearLocalAuthKeys failed', e);
  }
}

export default supabase;
