#!/usr/bin/env node

/**
 * CLI entrypoint for Leaseconnect.
 * Supports ingestion and export commands.
 *
 * Usage:
 *   npm run ingest -- --supplier athlon --mode file --path ./data/athlon.csv
 *   npm run ingest -- --supplier athlon --mode api
 *   npm run export -- --format csv --output ./exports/matches.csv
 */

import { runIngestion } from './jobs/runIngestion';
import { exportCsv, exportJson } from './exports';
import { logger } from './utils/logger';
import { config } from './utils/config';

interface CliArgs {
  command?: string;
  supplier?: string;
  mode?: 'file' | 'api';
  path?: string;
  format?: 'csv' | 'json';
  output?: string;
  [key: string]: unknown;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i++;
      } else {
        args[key] = true;
      }
    } else if (!args.command) {
      args.command = arg;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const command = args.command || 'ingest';

  logger.info('Leaseconnect CLI started', {
    command,
    nodeEnv: config.app.nodeEnv,
  });

  try {
    if (command === 'ingest') {
      // Ingestion command
      const supplierId = args.supplier;
      const mode = args.mode as 'file' | 'api' | undefined;
      const filePath = args.path;

      if (!supplierId) {
        logger.error('Missing required argument: --supplier');
        process.exit(1);
      }

      if (!mode || (mode !== 'file' && mode !== 'api')) {
        logger.error('Missing or invalid --mode (must be "file" or "api")');
        process.exit(1);
      }

      if (mode === 'file' && !filePath) {
        logger.error('Missing required argument: --path (required for file mode)');
        process.exit(1);
      }

      const result = await runIngestion({
        supplierId,
        mode,
        filePath,
      });

      logger.info('Ingestion completed successfully', {
        rawOffers: result.rawOffers.length,
        normalizedOffers: result.normalizedOffers.length,
        matches: result.matches.length,
      });
    } else if (command === 'export') {
      // Export command
      const format = args.format as 'csv' | 'json' | undefined;
      const output = args.output;

      if (!format || (format !== 'csv' && format !== 'json')) {
        logger.error('Missing or invalid --format (must be "csv" or "json")');
        process.exit(1);
      }

      if (!output) {
        logger.error('Missing required argument: --output');
        process.exit(1);
      }

      // TODO: Load matches from database
      // For now, export empty array (placeholder)
      const matches: any[] = [];

      if (format === 'csv') {
        await exportCsv(matches, output);
      } else {
        await exportJson(matches, output);
      }

      logger.info('Export completed successfully', {
        format,
        output,
        matchCount: matches.length,
      });
    } else {
      logger.error(`Unknown command: ${command}`);
      logger.info('Available commands: ingest, export');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Command failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  logger.error('Unhandled error', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

