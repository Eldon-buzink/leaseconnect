#!/usr/bin/env tsx

/**
 * Attempts to run migrations via Supabase REST API.
 */

import { readFile } from 'fs/promises';
import { config } from '../src/utils/config';
import { logger } from '../src/utils/logger';

async function runMigration() {
  logger.info('Attempting to create tables via Supabase API...');

  try {
    const sql = await readFile('./scripts/create-tables.sql', 'utf-8');
    
    // Supabase REST API endpoint for executing SQL (requires service role key)
    const supabaseUrl = config.supabase.url || `https://${config.supabase.projectId}.supabase.co`;
    const serviceRoleKey = config.supabase.serviceRoleKey;

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
    }

    // Try using Supabase REST API to execute SQL
    // Note: This endpoint may not be available or may require different authentication
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      // If REST API doesn't work, fall back to manual instructions
      logger.warn('Direct SQL execution via API not available');
      logger.info('');
      logger.info('Please run the SQL manually:');
      logger.info(`1. Open: https://supabase.com/dashboard/project/${config.supabase.projectId}/sql/new`);
      logger.info('2. Copy contents of: scripts/create-tables.sql');
      logger.info('3. Paste and click "Run"');
      logger.info('');
      logger.info('SQL file location: scripts/create-tables.sql');
      return;
    }

    const result = await response.json();
    logger.info('✅ Tables created successfully via API');
    logger.info('Result:', result);

  } catch (error) {
    logger.warn('Could not execute SQL via API (this is normal)');
    logger.info('');
    logger.info('Please run the SQL manually in Supabase SQL Editor:');
    logger.info(`1. Go to: https://supabase.com/dashboard/project/${config.supabase.projectId}/sql/new`);
    logger.info('2. Copy the SQL from: scripts/create-tables.sql');
    logger.info('3. Paste and click "Run"');
    logger.info('');
    logger.error('Error details:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

runMigration();

