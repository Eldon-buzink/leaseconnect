#!/usr/bin/env tsx

/**
 * Ingest and store data without matching.
 * This separates ingestion from matching to avoid timeouts.
 */

import { runIngestion } from '../src/jobs/runIngestion';
import { logger } from '../src/utils/logger';

async function ingestAndStore() {
  logger.info('Starting ingestion and storage (without matching)...');

  try {
    const result = await runIngestion({
      supplierId: 'athlon',
      mode: 'file',
      filePath: './src/examples/Athlon_bulk.xlsx',
      skipMatching: true, // Skip matching for now
    });

    logger.info('✅ Ingestion and storage completed!');
    logger.info('');
    logger.info('Summary:');
    logger.info(`  Raw offers: ${result.rawOffers.length}`);
    logger.info(`  Normalized offers: ${result.normalizedOffers.length}`);
    logger.info('');
    logger.info('Next step: Run matching separately:');
    logger.info('  npm run rematch-all');
  } catch (error) {
    logger.error('Ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

ingestAndStore();

