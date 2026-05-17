import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env ?? {};
const supabaseUrl: string = env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey: string = env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'Erro desconhecido';
}
