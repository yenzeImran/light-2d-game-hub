import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://luxcyteirojaczlsbgzc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y_UKZ2PZgbwSIRYsYSxUKg_gM71r9-D';

export let supabase: any;

export function initSupabase() {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client created');
}