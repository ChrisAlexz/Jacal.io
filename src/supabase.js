import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Native Clerk <-> Supabase integration: forward the Clerk session token with
// every request so Supabase RLS can authorize via auth.jwt()->>'sub' (the Clerk
// user id). Requires Clerk to be enabled as a third-party auth provider in the
// Supabase dashboard. Falls back to the anon key when signed out / on the server.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  async accessToken() {
    if (typeof window === 'undefined' || !window.Clerk?.session) return null;
    return window.Clerk.session.getToken();
  },
});