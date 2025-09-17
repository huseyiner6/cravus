import { supabase } from './client';

export async function signInEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error && !/User already registered/i.test(error.message)) throw error;
}

export async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('No active session');
  return data.session.access_token;
}

export async function signOut() {
  await supabase.auth.signOut();
}
