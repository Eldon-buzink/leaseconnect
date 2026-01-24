#!/usr/bin/env tsx

/**
 * Ingest and store data in chunks.
 * Processes data in smaller chunks and saves progress to avoid timeouts.
 */

import { getConnectors } from '../src/connectors';
import { normalizeOffers } from '../src/normalization/normalizeOffer';
import { storeRawOffers, storeNormalizedOffers } from '../src/utils/db';
import { getSupabaseClient } from '../src/utils/supabase';
import { logger } from '../src/utils/logger';
import { IngestionError } from '../src/utils/errors';

async function ingestChunked() {
  logger.info('Starting chunked ingestion and storage...');

  const filePath = './src/examples/Athlon_bulk.xlsx';
  const chunkSize = 5000; // Process 5000 at a time

  try {
    // Step 1: Ingest all raw offers (this is fast, just reading the file)
    logger.info('Step 1: Reading file...');
    const connectors = getConnectors('athlon');
    if (!connectors?.file) {
      throw new IngestionError('File connector not available for supplier: athlon', 'athlon');
    }

    const allRawOffers = await connectors.file(filePath);
    logger.info(`Loaded ${allRawOffers.length} raw offers from file`);

    // Step 2: Process in chunks
    let totalStoredRaw = 0;
    let totalStoredNormalized = 0;

    for (let i = 0; i < allRawOffers.length; i += chunkSize) {
      const chunk = allRawOffers.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(allRawOffers.length / chunkSize);

      logger.info('');
      logger.info(`Processing chunk ${chunkNum}/${totalChunks} (${chunk.length} offers)...`);

      try {
        // Store raw offers for this chunk
        logger.info(`  Storing raw offers (chunk ${chunkNum})...`);
        const rawOfferIds = await storeRawOffers(chunk);
        
        // storeRawOffers now only returns actual database IDs (no placeholders)
        // But the count might be less than chunk.length due to duplicates/failures
        // We need to match the returned IDs back to the original offers
        // Since upsert handles duplicates, we can't easily map IDs back to offers
        // So we'll query the database to get the stored offers and their IDs
        
        const supabase = getSupabaseClient();
        
        // Get the stored raw offers for this chunk by querying with supplier_offer_id
        const supplierOfferIds = chunk.map((o) => o.supplierOfferId);
        const { data: storedRawOffers } = await supabase
          .from('raw_offers')
          .select('id, supplier_offer_id')
          .in('supplier_offer_id', supplierOfferIds)
          .eq('supplier_id', 'athlon');
        
        if (!storedRawOffers || storedRawOffers.length === 0) {
          logger.warn(`  ⚠️  No raw offers were stored for chunk ${chunkNum}, skipping normalization`);
          continue;
        }
        
        // Create a map of supplier_offer_id -> database id
        const idMap = new Map<string, number>();
        storedRawOffers.forEach((row) => {
          idMap.set(row.supplier_offer_id, row.id);
        });
        
        // Match offers to their database IDs
        const validOffers: typeof chunk = [];
        const validRawOfferIds: number[] = [];
        
        chunk.forEach((offer) => {
          const dbId = idMap.get(offer.supplierOfferId);
          if (dbId) {
            validOffers.push(offer);
            validRawOfferIds.push(dbId);
          }
        });
        
        totalStoredRaw += validRawOfferIds.length;
        logger.info(`  ✅ Stored ${validRawOfferIds.length} raw offers (${chunk.length - validRawOfferIds.length} duplicates/skipped)`);

        if (validOffers.length === 0) {
          logger.info(`  ⏭️  Skipping normalization (no valid raw offers)`);
          continue;
        }

        // Normalize only the valid offers
        logger.info(`  Normalizing offers (chunk ${chunkNum})...`);
        const rawOffersWithIds = validOffers.map((offer, index) => ({
          rawOffer: offer,
          rawOfferId: validRawOfferIds[index],
        }));

        const normalizedOffers = await normalizeOffers(rawOffersWithIds);
        logger.info(`  ✅ Normalized ${normalizedOffers.length} offers`);

        // Store normalized offers for this chunk
        if (normalizedOffers.length > 0) {
          logger.info(`  Storing normalized offers (chunk ${chunkNum})...`);
          await storeNormalizedOffers(normalizedOffers);
          totalStoredNormalized += normalizedOffers.length;
          logger.info(`  ✅ Stored ${normalizedOffers.length} normalized offers`);
        }

        logger.info(`  ✅ Chunk ${chunkNum} completed!`);
      } catch (error) {
        logger.error(`  ❌ Chunk ${chunkNum} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next chunk
      }

      // Small delay between chunks
      if (i + chunkSize < allRawOffers.length) {
        logger.info(`  Waiting 2 seconds before next chunk...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    logger.info('');
    logger.info('✅ Chunked ingestion completed!');
    logger.info('');
    logger.info('Summary:');
    logger.info(`  Total raw offers: ${allRawOffers.length}`);
    logger.info(`  Stored raw offers: ${totalStoredRaw}`);
    logger.info(`  Stored normalized offers: ${totalStoredNormalized}`);
    logger.info('');
    logger.info('Next step: Run matching:');
    logger.info('  npm run rematch-all');
  } catch (error) {
    logger.error('Ingestion failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

ingestChunked();

