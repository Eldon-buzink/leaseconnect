#!/usr/bin/env tsx

/**
 * Test matching logic with a small sample.
 */

import { getSupabaseClient } from '../src/utils/supabase';
import { matchOffer } from '../src/matching/matchOffer';
import { logger } from '../src/utils/logger';
import { NormalizedOffer } from '../src/domain/types';

async function testMatching() {
  logger.info('Testing matching logic...');

  const supabase = getSupabaseClient();

  // Get a few normalized offers to test
  const { data: normalizedOffers, error } = await supabase
    .from('normalized_offers')
    .select('*')
    .limit(10);

  if (error) {
    logger.error('Failed to load normalized offers', { error: error.message });
    process.exit(1);
  }

  if (!normalizedOffers || normalizedOffers.length === 0) {
    logger.warn('No normalized offers found. Run ingestion first.');
    process.exit(1);
  }

  logger.info(`Testing with ${normalizedOffers.length} offers`);

  let matchCount = 0;
  let noMatchCount = 0;

  for (const row of normalizedOffers) {
    const normalizedOffer: NormalizedOffer = {
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
    };

    try {
      const match = await matchOffer(normalizedOffer);
      if (match) {
        matchCount++;
        logger.info(`✅ Match found`, {
          offer: `${normalizedOffer.make} ${normalizedOffer.model} ${normalizedOffer.year}`,
          vehicleId: match.canonicalVehicleId,
          score: match.confidenceScore,
          type: match.matchType,
          status: match.status,
        });
      } else {
        noMatchCount++;
        logger.info(`❌ No match`, {
          offer: `${normalizedOffer.make} ${normalizedOffer.model} ${normalizedOffer.year}`,
        });
      }
    } catch (error) {
      logger.error('Matching error', {
        offerId: normalizedOffer.supplierOfferId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('');
  logger.info('Test Results:');
  logger.info(`  Matches found: ${matchCount}`);
  logger.info(`  No matches: ${noMatchCount}`);
  logger.info(`  Total tested: ${normalizedOffers.length}`);
}

testMatching();

