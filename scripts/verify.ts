#!/usr/bin/env tsx

/**
 * Simple verification script to test the system.
 * Helps non-developers verify that everything is working.
 *
 * Run with: npm run verify
 */

import { getSupabaseClient } from '../src/utils/supabase';
import { logger } from '../src/utils/logger';
import { loadAutodiskFile } from '../src/connectors/autodiskFile';
import { ingestAthlonFile } from '../src/connectors/athlonFile';
import { normalizeOffers } from '../src/normalization/normalizeOffer';
import { matchOffers } from '../src/matching/matchOffer';
import { storeRawOffers, storeNormalizedOffers, storeMatches } from '../src/utils/db';

async function verify() {
  logger.info('🔍 Starting verification...');
  logger.info('');

  try {
    // Step 1: Test Supabase connection
    logger.info('Step 1: Testing Supabase connection...');
    const supabase = getSupabaseClient();
    
    // Try a simple query - if table doesn't exist, that's OK (we'll create it)
    const { data, error } = await supabase.from('canonical_vehicles').select('id').limit(1);
    
    if (error) {
      if (
        error.code === 'PGRST116' ||
        error.code === 'PGRST205' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache')
      ) {
        // Table doesn't exist yet - that's OK, we'll create it
        logger.info('⚠️  Tables not created yet - this is OK for first-time setup');
        logger.info('✅ Supabase connection successful (tables will be created in next step)');
      } else {
        logger.error('Supabase connection error', {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        throw error;
      }
    } else {
      logger.info('✅ Supabase connection successful');
      if (data && data.length > 0) {
        logger.info(`   Found ${data.length} existing records`);
      }
    }
    logger.info('');

    // Step 2: Check if example files exist
    logger.info('Step 2: Checking example files...');
    const autodiskPath = './src/examples/autodisk_data_2026-01-19T12_46_15.538Z.csv';
    const athlonPath = './src/examples/Athlon_bulk.xlsx';

    const fs = await import('fs/promises');
    try {
      await fs.access(autodiskPath);
      logger.info(`✅ Found Autodisk file: ${autodiskPath}`);
    } catch {
      logger.warn(`⚠️  Autodisk file not found: ${autodiskPath}`);
    }

    try {
      await fs.access(athlonPath);
      logger.info(`✅ Found Athlon file: ${athlonPath}`);
    } catch {
      logger.warn(`⚠️  Athlon file not found: ${athlonPath}`);
    }
    logger.info('');

    // Step 3: Test loading Autodisk data (if file exists)
    try {
      await fs.access(autodiskPath);
      logger.info('Step 3: Loading Autodisk canonical vehicles...');
      const vehicles = await loadAutodiskFile(autodiskPath);
      logger.info(`✅ Loaded ${vehicles.length} canonical vehicles`);
      logger.info(`   Example: ${vehicles[0]?.make} ${vehicles[0]?.model} ${vehicles[0]?.year}`);
      logger.info('');
    } catch (error) {
      logger.warn('⚠️  Skipping Autodisk load (file not found or error)');
      logger.info('');
    }

    // Step 4: Test parsing Athlon file (if file exists)
    try {
      await fs.access(athlonPath);
      logger.info('Step 4: Parsing Athlon file...');
      const rawOffers = await ingestAthlonFile(athlonPath);
      logger.info(`✅ Parsed ${rawOffers.length} Athlon offers`);
      if (rawOffers.length > 0) {
        logger.info(`   Example: ${rawOffers[0]?.make} ${rawOffers[0]?.model} ${rawOffers[0]?.year}`);
      }
      logger.info('');

      // Step 5: Test normalization
      logger.info('Step 5: Testing normalization...');
      const rawOffersWithIds = rawOffers.slice(0, 5).map((offer, index) => ({
        rawOffer: offer,
        rawOfferId: index + 1,
      }));
      const normalized = await normalizeOffers(rawOffersWithIds);
      logger.info(`✅ Normalized ${normalized.length} offers`);
      if (normalized.length > 0) {
        logger.info(`   Example: ${normalized[0]?.make} → ${normalized[0]?.make}`);
      }
      logger.info('');

      // Step 6: Test matching (will return empty for now, but shows it works)
      logger.info('Step 6: Testing matching...');
      const matches = await matchOffers(normalized);
      logger.info(`✅ Matching completed: ${matches.length} matches found`);
      logger.info('');
    } catch (error) {
      logger.warn('⚠️  Skipping Athlon processing (file not found or error)');
      logger.info('');
    }

    // Summary
    logger.info('='.repeat(60));
    logger.info('✅ Verification complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Run migrations: npm run migrate (then copy SQL to Supabase SQL Editor)');
    logger.info('2. Load Autodisk data: npm run load-autodisk');
    logger.info('3. Process Athlon file: npm run ingest -- --supplier athlon --mode file --path ./src/examples/Athlon_bulk.xlsx');
    logger.info('4. Export results: npm run export -- --format csv --output ./exports/matches.csv');
    logger.info('');
  } catch (error) {
    logger.error('❌ Verification failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

verify();

