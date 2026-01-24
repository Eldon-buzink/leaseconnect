/**
 * Ingestion job orchestrator.
 * Coordinates the full pipeline: ingest → normalize → match → export.
 *
 * TODO: Implement database persistence
 * - Store raw offers in database
 * - Store normalized offers in database
 * - Store match results in database
 * - Handle idempotency
 * - Support incremental updates
 */

import { RawSupplierOffer, NormalizedOffer, MatchResult } from '../domain/types';
import { getConnectors } from '../connectors';
import { normalizeOffers } from '../normalization/normalizeOffer';
import { matchOffers } from '../matching/matchOffer';
import { logger } from '../utils/logger';
import { IngestionError } from '../utils/errors';
import { storeRawOffers, storeNormalizedOffers, storeMatches } from '../utils/db';

export interface IngestionOptions {
  supplierId: string;
  mode: 'file' | 'api';
  filePath?: string;
  apiConfig?: unknown;
  skipNormalization?: boolean;
  skipMatching?: boolean;
  skipExport?: boolean;
}

export interface IngestionResult {
  rawOffers: RawSupplierOffer[];
  normalizedOffers: NormalizedOffer[];
  matches: MatchResult[];
}

/**
 * Runs the complete ingestion pipeline.
 *
 * @param options - Ingestion options
 * @returns Ingestion result with all processed data
 */
export async function runIngestion(options: IngestionOptions): Promise<IngestionResult> {
  logger.info('Starting ingestion pipeline', {
    supplierId: options.supplierId,
    mode: options.mode,
  });

  // Step 1: Ingest raw offers
  const connectors = getConnectors(options.supplierId);
  if (!connectors) {
    throw new IngestionError(
      `No connectors found for supplier: ${options.supplierId}`,
      options.supplierId
    );
  }

  let rawOffers: RawSupplierOffer[];
  if (options.mode === 'file') {
    if (!connectors.file) {
      throw new IngestionError(
        `File connector not available for supplier: ${options.supplierId}`,
        options.supplierId
      );
    }
    if (!options.filePath) {
      throw new IngestionError(
        'File path required for file-based ingestion',
        options.supplierId
      );
    }
    rawOffers = await connectors.file(options.filePath);
  } else {
    if (!connectors.api) {
      throw new IngestionError(
        `API connector not available for supplier: ${options.supplierId}`,
        options.supplierId
      );
    }
    rawOffers = await connectors.api(options.apiConfig as any);
  }

  logger.info('Raw offers ingested', {
    supplierId: options.supplierId,
    count: rawOffers.length,
  });

  // Step 1b: Store raw offers in database
  let rawOfferIds: number[] = [];
  try {
    rawOfferIds = await storeRawOffers(rawOffers);
    logger.info('Raw offers stored in database', {
      supplierId: options.supplierId,
      count: rawOfferIds.length,
    });
  } catch (error) {
    logger.warn('Failed to store raw offers in database, continuing with placeholder IDs', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback to placeholder IDs
    rawOfferIds = rawOffers.map((_, index) => index + 1);
  }

  // Step 2: Normalize offers
  let normalizedOffers: NormalizedOffer[] = [];
  if (!options.skipNormalization) {
    const rawOffersWithIds = rawOffers.map((offer, index) => ({
      rawOffer: offer,
      rawOfferId: rawOfferIds[index] || index + 1,
    }));

    normalizedOffers = await normalizeOffers(rawOffersWithIds);

    logger.info('Offers normalized', {
      supplierId: options.supplierId,
      count: normalizedOffers.length,
    });

    // Step 2b: Store normalized offers in database
    try {
      await storeNormalizedOffers(normalizedOffers);
      logger.info('Normalized offers stored in database', {
        supplierId: options.supplierId,
        count: normalizedOffers.length,
      });
    } catch (error) {
      logger.warn('Failed to store normalized offers in database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Step 3: Match offers
  let matches: MatchResult[] = [];
  if (!options.skipMatching && normalizedOffers.length > 0) {
    matches = await matchOffers(normalizedOffers);

    logger.info('Offers matched', {
      supplierId: options.supplierId,
      count: matches.length,
    });

    // Step 3b: Store match results in database
    try {
      await storeMatches(matches);
      logger.info('Matches stored in database', {
        supplierId: options.supplierId,
        count: matches.length,
      });
    } catch (error) {
      logger.warn('Failed to store matches in database', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Step 4: Export (optional, handled by CLI)
  if (!options.skipExport && matches.length > 0) {
    logger.info('Export skipped in job (use CLI export command)', {
      matchCount: matches.length,
    });
  }

  logger.info('Ingestion pipeline completed', {
    supplierId: options.supplierId,
    rawOffers: rawOffers.length,
    normalizedOffers: normalizedOffers.length,
    matches: matches.length,
  });

  return {
    rawOffers,
    normalizedOffers,
    matches,
  };
}

