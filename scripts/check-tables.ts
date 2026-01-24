#!/usr/bin/env tsx

/**
 * Check if tables exist in Supabase.
 */

import { getSupabaseClient } from '../src/utils/supabase';
import { logger } from '../src/utils/logger';

async function checkTables() {
  const supabase = getSupabaseClient();
  const tables = [
    'canonical_vehicles',
    'raw_offers',
    'normalized_offers',
    'matches',
    'override_mappings',
  ];

  logger.info('Checking if tables exist...');
  logger.info('');

  let allExist = true;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST205') {
          logger.warn(`❌ Table "${table}" does not exist`);
          allExist = false;
        } else {
          logger.error(`Error checking "${table}":`, error.message);
        }
      } else {
        logger.info(`✅ Table "${table}" exists`);
      }
    } catch (error) {
      logger.error(`Error checking "${table}":`, error instanceof Error ? error.message : String(error));
      allExist = false;
    }
  }

  logger.info('');

  if (!allExist) {
    logger.warn('⚠️  Some tables are missing. Please create them first:');
    logger.info('1. Go to: https://supabase.com/dashboard/project/qkcjlbycgytlinsblrja/sql/new');
    logger.info('2. Copy SQL from: scripts/create-tables.sql');
    logger.info('3. Paste and run');
    logger.info('');
    return false;
  } else {
    logger.info('✅ All tables exist!');
    return true;
  }
}

checkTables().then((exists) => {
  process.exit(exists ? 0 : 1);
});

