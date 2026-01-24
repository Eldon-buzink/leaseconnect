#!/usr/bin/env tsx

/**
 * Re-match all existing normalized offers.
 * Useful after implementing matching logic or updating matching rules.
 */

import { getSupabaseClient } from '../src/utils/supabase';
import { matchOffers, matchOffer } from '../src/matching/matchOffer';
import { storeMatches } from '../src/utils/db';
import { logger } from '../src/utils/logger';
import { NormalizedOffer } from '../src/domain/types';

async function rematchAll() {
  logger.info('Starting re-matching of all normalized offers...');

  const supabase = getSupabaseClient();

  // Get count first
  const { count } = await supabase
    .from('normalized_offers')
    .select('*', { count: 'exact', head: true });

  logger.info(`Found ${count} normalized offers to match`);

  if (!count || count === 0) {
    logger.warn('No normalized offers found. Run ingestion first.');
    return;
  }

  // Process in smaller batches with delays to avoid timeouts
  const batchSize = 50;
  const delayBetweenBatches = 200; // ms
  let processed = 0;
  let totalMatches = 0;
  let totalNoMatches = 0;

  // Delete existing matches first (optional - comment out if you want to keep them)
  logger.info('Clearing existing matches...');
  try {
    await supabase.from('matches').delete().neq('id', 0); // Delete all matches
    logger.info('Existing matches cleared');
  } catch (error) {
    logger.warn('Could not clear existing matches, continuing anyway', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  while (processed < count!) {
    try {
      const { data: normalizedOffers, error } = await supabase
        .from('normalized_offers')
        .select('*')
        .range(processed, processed + batchSize - 1);

      if (error) {
        logger.error('Failed to load normalized offers', { error: error.message });
        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!normalizedOffers || normalizedOffers.length === 0) {
        break;
      }

      // Convert to NormalizedOffer format
      // Create a map to store database IDs for later use
      const dbIdMap = new Map<number, number>(); // rawOfferId -> dbId
      normalizedOffers.forEach((row) => {
        dbIdMap.set(row.raw_offer_id, row.id);
      });

      const offers: NormalizedOffer[] = normalizedOffers.map((row) => ({
        rawOfferId: row.raw_offer_id,
        supplierId: row.supplier_id,
        supplierOfferId: row.supplier_offer_id,
        make: row.make,
        model: row.model,
        trim: row.trim,
        year: row.year,
        fuelType: row.fuel_type,
        transmission: row.transmission,
        doors: row.doors,
        seats: row.seats,
        engineSize: row.engine_size,
        powerHp: row.power_hp,
        co2Emissions: row.co2_emissions,
        price: null,
        currency: null,
        normalizationStatus: row.normalization_status as 'success' | 'partial' | 'failed',
        normalizationNotes: row.normalization_notes,
        normalizedAt: new Date(row.normalized_at),
      }));

      // Match this batch
      const matches = await matchOffers(offers);

      // Update match results with correct database IDs
      // matchOffer uses getNormalizedOfferId which may return rawOfferId,
      // but we need the actual database ID
      for (const match of matches) {
        const dbId = dbIdMap.get(match.normalizedOfferId);
        if (dbId) {
          match.normalizedOfferId = dbId;
        }
      }

      // Store matches in smaller batches
      if (matches.length > 0) {
        await storeMatches(matches);
        totalMatches += matches.length;
      }

      totalNoMatches += offers.length - matches.length;
      processed += offers.length;

      // Log progress every 500 records or at the end
      if (processed % 500 === 0 || processed >= count!) {
        logger.info(`Progress: ${processed}/${count} (${Math.round((processed / count!) * 100)}%)`, {
          matches: totalMatches,
          noMatches: totalNoMatches,
        });
      }
    } catch (error) {
      logger.error('Error processing batch', {
        processed,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue with next batch
      processed += batchSize;
    }

    // Small delay between batches to avoid overwhelming the system
    if (processed < count!) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  logger.info('');
  logger.info('✅ Re-matching complete!');
  logger.info(`   Total processed: ${processed}`);
  logger.info(`   Matches found: ${totalMatches}`);
  logger.info(`   No matches: ${totalNoMatches}`);
  logger.info(`   Match rate: ${((totalMatches / processed) * 100).toFixed(1)}%`);
}

rematchAll().catch((error) => {
  logger.error('Re-matching failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

