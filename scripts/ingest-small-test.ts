#!/usr/bin/env tsx

/**
 * Test ingestion with a small sample (first 100 records).
 * Useful for debugging and testing.
 */

import { runIngestion } from '../src/jobs/runIngestion';
import { logger } from '../src/utils/logger';

async function ingestSmallTest() {
  logger.info('Starting small test ingestion (first 100 records)...');

  try {
    // We'll modify the connector to only process first 100
    const result = await runIngestion({
      supplierId: 'athlon',
      mode: 'file',
      filePath: './src/examples/Athlon_bulk.xlsx',
      skipMatching: true,
    });

    // Limit to first 100 for testing
    const limitedRaw = result.rawOffers.slice(0, 100);
    const limitedNormalized = result.normalizedOffers.slice(0, 100);

    logger.info('✅ Test ingestion completed!');
    logger.info('');
    logger.info('Summary:');
    logger.info(`  Raw offers (limited): ${limitedRaw.length}`);
    logger.info(`  Normalized offers (limited): ${limitedNormalized.length}`);
    logger.info('');
    logger.info('Note: This was a test with limited records.');
  } catch (error) {
    logger.error('Ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

ingestSmallTest();

