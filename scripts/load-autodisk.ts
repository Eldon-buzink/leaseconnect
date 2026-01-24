#!/usr/bin/env tsx

/**
 * Load Autodisk canonical vehicle data into database.
 *
 * Run with: npm run load-autodisk
 */

import { loadAutodiskFile } from '../src/connectors/autodiskFile';
import { logger } from '../src/utils/logger';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function findAutodiskFile(): Promise<string> {
  const examplesDir = './src/examples';
  const files = await readdir(examplesDir);
  const autodiskFile = files.find((f) => f.startsWith('autodisk_data') && f.endsWith('.csv'));
  if (!autodiskFile) {
    throw new Error(`No Autodisk CSV file found in ${examplesDir}`);
  }
  return join(examplesDir, autodiskFile);
}

async function loadAutodisk() {
  logger.info('Loading Autodisk canonical vehicles...');
  
  const autodiskPath = await findAutodiskFile();
  logger.info(`File: ${autodiskPath}`);

  try {
    const vehicles = await loadAutodiskFile(autodiskPath);
    logger.info(`✅ Successfully loaded ${vehicles.length} canonical vehicles`);
    logger.info('');
    logger.info('Sample vehicles:');
    vehicles.slice(0, 5).forEach((v) => {
      logger.info(`  - ${v.make} ${v.model} ${v.trim || ''} ${v.year}`);
    });
  } catch (error) {
    logger.error('Failed to load Autodisk data', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

loadAutodisk();
