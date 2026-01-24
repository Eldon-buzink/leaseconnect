/**
 * Supabase client initialization.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { logger } from './logger';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client.
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || `https://${config.supabase.projectId}.supabase.co`;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseKey) {
    throw new Error('Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  logger.info('Supabase client initialized', {
    url: supabaseUrl,
  });

  return supabaseClient;
}

