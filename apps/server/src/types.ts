import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AppVariables = { supabase: SupabaseClient; user: User };
