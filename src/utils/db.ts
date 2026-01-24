/**
 * Database utilities using Supabase.
 */

import { getSupabaseClient } from './supabase';
import { RawSupplierOffer, NormalizedOffer, MatchResult, CanonicalVehicle } from '../domain/types';
import { logger } from './logger';

/**
 * Store raw offers in database.
 * Processes in small batches with retries and delays to avoid timeouts.
 */
export async function storeRawOffers(offers: RawSupplierOffer[]): Promise<number[]> {
  const supabase = getSupabaseClient();
  const ids: number[] = [];

  // Smaller batch size to avoid timeouts
  const batchSize = 100;
  const delayBetweenBatches = 100; // ms
  let stored = 0;

  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    const rows = batch.map((offer) => ({
      supplier_id: offer.supplierId,
      supplier_offer_id: offer.supplierOfferId,
      ingested_at: offer.receivedAt.toISOString(),
      ingestion_mode: 'file',
      raw_data: {
        make: offer.make,
        model: offer.model,
        trim: offer.trim,
        year: offer.year,
        fuelType: offer.fuelType,
        transmission: offer.transmission,
        doors: offer.doors,
        seats: offer.seats,
        engineSize: offer.engineSize,
        powerHp: offer.powerHp,
        co2Emissions: offer.co2Emissions,
        price: offer.price,
        currency: offer.currency,
        ...offer.additionalFields,
      },
    }));

    // Deduplicate rows within the batch based on unique constraint
    const seen = new Set<string>();
    const uniqueRows = rows.filter((row) => {
      const key = `${row.supplier_id}:${row.supplier_offer_id}:${row.ingested_at}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (uniqueRows.length < rows.length) {
      logger.debug('Deduplicated batch', {
        original: rows.length,
        unique: uniqueRows.length,
        removed: rows.length - uniqueRows.length,
      });
    }

    // Retry logic
    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const { data, error } = await supabase
          .from('raw_offers')
          .upsert(uniqueRows, {
            onConflict: 'supplier_id,supplier_offer_id,ingested_at',
            ignoreDuplicates: false,
          })
          .select('id');

        if (error) {
          throw error;
        }

        if (data) {
          ids.push(...data.map((row) => row.id));
          stored += data.length;
        }

        success = true;

        // Log progress every 1000 records
        if (stored % 1000 === 0 || i + batchSize >= offers.length) {
          logger.info('Storing raw offers...', {
            progress: `${stored}/${offers.length}`,
            percent: Math.round((stored / offers.length) * 100),
          });
        }
      } catch (error) {
        retries--;
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
              ? JSON.stringify(error)
              : String(error);
        const errorDetails =
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : typeof error === 'object' && error !== null
              ? error
              : { error: String(error) };

        if (retries === 0) {
          logger.warn('Failed to store raw offers batch after retries', {
            batchStart: i,
            batchSize: batch.length,
            error: errorMessage,
            errorDetails,
          });
          // Don't add placeholder IDs - just skip this batch
          // The caller should handle the mismatch between input and output
        } else {
          logger.debug(`Retrying raw offers batch (${retries} retries left)`, {
            batchStart: i,
            error: errorMessage,
          });
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, (4 - retries) * 1000)
          );
        }
      }
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < offers.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  logger.info('Raw offers storage completed', {
    total: offers.length,
    stored,
  });

  return ids;
}

/**
 * Store normalized offers in database.
 * Uses upsert to handle duplicates gracefully.
 * Processes in small batches with retries and delays to avoid timeouts.
 */
export async function storeNormalizedOffers(offers: NormalizedOffer[]): Promise<void> {
  const supabase = getSupabaseClient();

  // Smaller batch size to avoid timeouts
  const batchSize = 100;
  const delayBetweenBatches = 100; // ms
  let stored = 0;
  let skipped = 0;

  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    const rows = batch.map((offer) => ({
      raw_offer_id: offer.rawOfferId,
      supplier_id: offer.supplierId,
      supplier_offer_id: offer.supplierOfferId,
      normalized_at: offer.normalizedAt.toISOString(),
      make: offer.make,
      model: offer.model,
      trim: offer.trim,
      year: offer.year,
      fuel_type: offer.fuelType,
      transmission: offer.transmission,
      doors: offer.doors,
      seats: offer.seats,
      engine_size: offer.engineSize,
      power_hp: offer.powerHp,
      co2_emissions: offer.co2Emissions,
      normalization_status: offer.normalizationStatus,
      normalization_notes: offer.normalizationNotes,
    }));

    // Deduplicate rows within the batch based on unique constraint (raw_offer_id)
    const seen = new Set<number>();
    const uniqueRows = rows.filter((row) => {
      if (seen.has(row.raw_offer_id)) {
        return false;
      }
      seen.add(row.raw_offer_id);
      return true;
    });

    if (uniqueRows.length < rows.length) {
      logger.debug('Deduplicated normalized offers batch', {
        original: rows.length,
        unique: uniqueRows.length,
        removed: rows.length - uniqueRows.length,
      });
    }

    // Retry logic
    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const { error } = await supabase
          .from('normalized_offers')
          .upsert(uniqueRows, {
            onConflict: 'raw_offer_id',
            ignoreDuplicates: false,
          });

        if (error) {
          throw error;
        }

        stored += batch.length;
        success = true;

        // Log progress every 1000 records
        if (stored % 1000 === 0 || i + batchSize >= offers.length) {
          logger.info('Storing normalized offers...', {
            progress: `${stored}/${offers.length}`,
            percent: Math.round((stored / offers.length) * 100),
          });
        }
      } catch (error) {
        retries--;
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
              ? JSON.stringify(error)
              : String(error);
        const errorDetails =
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : typeof error === 'object' && error !== null
              ? error
              : { error: String(error) };

        if (retries === 0) {
          logger.warn('Failed to store normalized offers batch after retries', {
            batchStart: i,
            batchSize: batch.length,
            error: errorMessage,
            errorDetails,
          });
          skipped += batch.length;
        } else {
          logger.debug(`Retrying normalized offers batch (${retries} retries left)`, {
            batchStart: i,
            error: errorMessage,
          });
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, (4 - retries) * 1000)
          );
        }
      }
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + batchSize < offers.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  logger.info('Normalized offers storage completed', {
    total: offers.length,
    stored,
    skipped,
  });
}

/**
 * Store match results in database.
 * Uses upsert to handle duplicates.
 */
export async function storeMatches(matches: MatchResult[]): Promise<void> {
  const supabase = getSupabaseClient();

  if (matches.length === 0) {
    return;
  }

  // Process in batches
  const batchSize = 1000;
  let stored = 0;
  let skipped = 0;

  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const rows = batch.map((match) => ({
      normalized_offer_id: match.normalizedOfferId,
      canonical_vehicle_id: match.canonicalVehicleId,
      match_type: match.matchType,
      confidence_score: match.confidenceScore,
      match_algorithm: match.matchAlgorithm,
      status: match.status,
      matched_at: match.matchedAt.toISOString(),
      updated_at: match.updatedAt.toISOString(),
    }));

    // Use upsert to handle duplicates
    const { error } = await supabase
      .from('matches')
      .upsert(rows, {
        onConflict: 'normalized_offer_id',
        ignoreDuplicates: false, // Update if exists
      });

    if (error) {
      logger.error('Failed to store matches batch', {
        batchStart: i,
        batchSize: batch.length,
        error: error.message,
      });
      skipped += batch.length;
    } else {
      stored += batch.length;
      logger.debug('Stored matches batch', {
        batchStart: i,
        batchSize: batch.length,
        totalStored: stored,
      });
    }
  }

  logger.info('Matches storage completed', {
    total: matches.length,
    stored,
    skipped,
  });
}

/**
 * Load canonical vehicles from database.
 */
export async function loadCanonicalVehicles(): Promise<CanonicalVehicle[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('canonical_vehicles')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Failed to load canonical vehicles', { error: error.message });
    throw error;
  }

  return (
    data?.map((row) => ({
      id: row.id,
      autodiskId: row.autodisk_id,
      make: row.make,
      model: row.model,
      trim: row.trim,
      year: row.year,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      doors: row.nr_of_doors,
      seats: null, // Not in current schema
      engineSize: null, // Parse from engine field if needed
      powerHp: null, // Parse from version if needed
      co2Emissions: null,
      specification: row.specification || {},
      isActive: row.is_active,
    })) || []
  );
}

