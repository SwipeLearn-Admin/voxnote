import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { getSettings, setSettings } from './settings';

// Supabase configuration - FIXED for this project (MUST NEVER CHANGE)
// Project ref: puiqcxfibmnoimdsdjpq
const SUPABASE_URL = 'https://puiqcxfibmnoimdsdjpq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aXFjeGZpYm1ub2ltZHNkanBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDkxNjAsImV4cCI6MjA4NTEyNTE2MH0.7Vin1fcu4q1imkW-tg8EdEbsWOnzUaX0-wCoWtQNxpc';

// Runtime guard: ensure we never accidentally switch to a different project
const EXPECTED_PROJECT_REF = 'puiqcxfibmnoimdsdjpq';
if (!SUPABASE_URL.includes(EXPECTED_PROJECT_REF)) {
  throw new Error(`FATAL: Supabase URL does not contain expected project ref "${EXPECTED_PROJECT_REF}". This is a configuration error.`);
}

let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export function initSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabase;
}

/**
 * Get the Supabase client instance
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

export interface AuthResult {
  success: boolean;
  user?: User | null;
  error?: string;
}

export interface SessionResult {
  session: Session | null;
  user: User | null;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const client = getSupabase();

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const client = getSupabase();

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  const { error } = await client.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get current session
 */
export async function getSession(): Promise<SessionResult> {
  const client = getSupabase();

  const { data } = await client.auth.getSession();

  return {
    session: data.session,
    user: data.session?.user || null,
  };
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabase();

  const { data } = await client.auth.getUser();

  return data.user;
}

// ============================================
// ARTIFACT FUNCTIONS
// ============================================

export interface ArtifactData {
  id?: string;
  mode: string;
  title?: string;
  transcript: string;
  result_markdown: string;
  result_json?: unknown;
  language?: string;
  instruction?: string;
  created_at?: string;
}

export interface ArtifactRow extends ArtifactData {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Push a new artifact to Supabase
 */
export async function pushArtifact(artifact: ArtifactData): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getSupabase();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await client
    .from('artifacts')
    .insert({
      ...artifact,
      user_id: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to push artifact:', error);
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * Pull artifacts from Supabase
 */
export async function pullArtifacts(limit = 100): Promise<{ success: boolean; artifacts?: ArtifactRow[]; error?: string }> {
  const client = getSupabase();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data, error } = await client
    .from('artifacts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to pull artifacts:', error);
    return { success: false, error: error.message };
  }

  return { success: true, artifacts: data as ArtifactRow[] };
}

/**
 * Delete an artifact from Supabase
 */
export async function deleteArtifact(id: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  const { error } = await client
    .from('artifacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete artifact:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}
