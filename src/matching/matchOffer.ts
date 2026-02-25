/**
 * Matching module.
 * Matches normalized offers to canonical vehicles from Autodisk.
 */

import { NormalizedOffer, MatchResult, CanonicalVehicle } from '../domain/types';
import { logger } from '../utils/logger';
import { MatchingError } from '../utils/errors';
import { config } from '../utils/config';
import { getSupabaseClient } from '../utils/supabase';
import { calculateMatchScoreDetailed, MatchScoreComponents } from './similarity';

// Cache canonical vehicles in memory (updated on first load)
let canonicalVehiclesCache: CanonicalVehicle[] | null = null;
let cacheLoadTime: Date | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load canonical vehicles (with caching).
 */
async function loadCanonicalVehiclesCached(): Promise<CanonicalVehicle[]> {
  const now = new Date();
  
  // Return cached data if still valid
  if (
    canonicalVehiclesCache &&
    cacheLoadTime &&
    now.getTime() - cacheLoadTime.getTime() < CACHE_TTL_MS
  ) {
    return canonicalVehiclesCache;
  }

  // Load from database (with pagination)
  const supabase = getSupabaseClient();
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('canonical_vehicles')
      .select('*')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.error('Failed to load canonical vehicles', { error: error.message });
      throw error;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      page++;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  canonicalVehiclesCache = allData.map((row) => ({
      id: row.id,
      autodiskId: row.autodisk_id,
      make: row.make,
      model: row.model,
      trim: row.trim,
      year: row.year,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      doors: row.nr_of_doors,
      seats: null,
      engineSize: row.engine_size,
      powerHp: row.power_hp,
      co2Emissions: null,
      specification: row.specification || {},
      isActive: row.is_active,
    })) || [];

  cacheLoadTime = now;
  logger.info('Loaded canonical vehicles cache', { count: canonicalVehiclesCache.length });

  return canonicalVehiclesCache;
}

/**
 * Check for override mapping.
 */
async function checkOverrideMapping(
  normalizedOffer: NormalizedOffer
): Promise<number | null> {
  const supabase = getSupabaseClient();

  // Build query for override mappings
  let query = supabase
    .from('override_mappings')
    .select('canonical_vehicle_id')
    .eq('supplier_id', normalizedOffer.supplierId)
    .eq('is_active', true);

  // Add optional filters
  if (normalizedOffer.make) {
    query = query.or(`supplier_make.is.null,supplier_make.eq.${normalizedOffer.make}`);
  }
  if (normalizedOffer.model) {
    query = query.or(`supplier_model.is.null,supplier_model.eq.${normalizedOffer.model}`);
  }
  if (normalizedOffer.year) {
    query = query.or(`supplier_year.is.null,supplier_year.eq.${normalizedOffer.year}`);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means no rows found, which is OK
    logger.debug('Override mapping check error', { error: error.message });
  }

  return data?.canonical_vehicle_id || null;
}

/**
 * Deterministic matching - exact match on key fields.
 */
function deterministicMatch(
  normalizedOffer: NormalizedOffer,
  canonicalVehicles: CanonicalVehicle[]
): CanonicalVehicle | null {
  for (const vehicle of canonicalVehicles) {
    // Check make (exact match, case-insensitive)
    if (
      normalizedOffer.make &&
      vehicle.make &&
      normalizedOffer.make.toLowerCase() !== vehicle.make.toLowerCase()
    ) {
      continue;
    }

    // Check model (exact match, case-insensitive)
    if (
      normalizedOffer.model &&
      vehicle.model &&
      normalizedOffer.model.toLowerCase() !== vehicle.model.toLowerCase()
    ) {
      continue;
    }

    // Check year (exact match or within 1 year)
    if (normalizedOffer.year && vehicle.year) {
      const yearDiff = Math.abs(normalizedOffer.year - vehicle.year);
      if (yearDiff > 1) {
        continue;
      }
    }

    // Check trim (exact match or both missing)
    if (normalizedOffer.trim && vehicle.trim) {
      if (
        normalizedOffer.trim.toLowerCase() !== vehicle.trim.toLowerCase()
      ) {
        continue;
      }
    }

    // Found deterministic match
    return vehicle;
  }

  return null;
}

/**
 * Scored matching - fuzzy matching with confidence scores.
 */
function scoredMatch(
  normalizedOffer: NormalizedOffer,
  canonicalVehicles: CanonicalVehicle[],
  minScore: number = 0.6
): Array<{ vehicle: CanonicalVehicle; score: number; components: MatchScoreComponents }> {
  const candidates: Array<{
    vehicle: CanonicalVehicle;
    score: number;
    components: MatchScoreComponents;
  }> = [];

  // Filter by make first (if available) for performance
  const filteredVehicles = normalizedOffer.make
    ? canonicalVehicles.filter(
        (v) => v.make.toLowerCase() === normalizedOffer.make!.toLowerCase()
      )
    : canonicalVehicles;

  // If no make match, try model-based filtering
  const searchVehicles =
    filteredVehicles.length > 0
      ? filteredVehicles
      : normalizedOffer.model
        ? canonicalVehicles.filter((v) =>
            v.model.toLowerCase().includes(normalizedOffer.model!.toLowerCase())
          )
        : canonicalVehicles;

  // Calculate scores for all candidates
  for (const vehicle of searchVehicles) {
    const components = calculateMatchScoreDetailed({
      make: {
        offer: normalizedOffer.make,
        canonical: vehicle.make,
      },
      model: {
        offer: normalizedOffer.model,
        canonical: vehicle.model,
      },
      year: {
        offer: normalizedOffer.year,
        canonical: vehicle.year,
      },
      trim: {
        offer: normalizedOffer.trim,
        canonical: vehicle.trim,
      },
      fuelType: {
        offer: normalizedOffer.fuelType,
        canonical: vehicle.fuelType,
      },
      transmission: {
        offer: normalizedOffer.transmission,
        canonical: vehicle.transmission,
      },
      powerHp: {
        offer: normalizedOffer.powerHp,
        canonical: vehicle.powerHp,
      },
    });

    const score = components.overall;

    if (score >= minScore) {
      candidates.push({ vehicle, score, components });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Get normalized offer ID from database using rawOfferId.
 * If not found, try to find by supplier_offer_id as fallback.
 * Uses a simple cache to avoid repeated lookups for the same offer.
 */
const normalizedOfferIdCache = new Map<string, number>();

async function getNormalizedOfferId(
  rawOfferId: number,
  supplierOfferId: string
): Promise<number> {
  // Check cache first
  const cacheKey = `${rawOfferId}:${supplierOfferId}`;
  if (normalizedOfferIdCache.has(cacheKey)) {
    return normalizedOfferIdCache.get(cacheKey)!;
  }

  const supabase = getSupabaseClient();
  
  // First try by raw_offer_id
  let { data, error } = await supabase
    .from('normalized_offers')
    .select('id')
    .eq('raw_offer_id', rawOfferId)
    .maybeSingle();

  // If not found, try by supplier_offer_id
  if (error || !data) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('normalized_offers')
      .select('id')
      .eq('supplier_offer_id', supplierOfferId)
      .maybeSingle();

    if (fallbackError || !fallbackData) {
      logger.warn('Normalized offer not found in database', {
        rawOfferId,
        supplierOfferId,
      });
      throw new Error(
        `Normalized offer not found for raw_offer_id: ${rawOfferId}, supplier_offer_id: ${supplierOfferId}`
      );
    }

    normalizedOfferIdCache.set(cacheKey, fallbackData.id);
    return fallbackData.id;
  }

  normalizedOfferIdCache.set(cacheKey, data.id);
  return data.id;
}

/**
 * Matches a normalized offer to a canonical vehicle.
 *
 * @param normalizedOffer - Normalized offer to match
 * @returns Match result, or null if no match found
 * @throws {MatchingError} If matching fails critically
 */
export async function matchOffer(
  normalizedOffer: NormalizedOffer
): Promise<MatchResult | null> {
  logger.debug('Matching offer', {
    supplierId: normalizedOffer.supplierId,
    offerId: normalizedOffer.supplierOfferId,
    make: normalizedOffer.make,
    model: normalizedOffer.model,
    year: normalizedOffer.year,
  });

  try {
    // Load canonical vehicles (cached)
    const canonicalVehicles = await loadCanonicalVehiclesCached();

    if (canonicalVehicles.length === 0) {
      logger.warn('No canonical vehicles available for matching');
      return null;
    }

    // Get normalized offer ID from database
    const normalizedOfferId = await getNormalizedOfferId(
      normalizedOffer.rawOfferId,
      normalizedOffer.supplierOfferId
    );

    // Step 1: Check override mappings first
    const overrideVehicleId = await checkOverrideMapping(normalizedOffer);
    if (overrideVehicleId) {
      const overrideVehicle = canonicalVehicles.find((v) => v.id === overrideVehicleId);
      if (overrideVehicle) {
        logger.debug('Found override mapping', {
          offerId: normalizedOffer.supplierOfferId,
          vehicleId: overrideVehicle.id,
        });

        const explanation = 'Matched via manual override mapping for this supplier offer.';

        return {
          id: 0, // Will be set by database
          normalizedOfferId,
          canonicalVehicleId: overrideVehicle.id,
          matchType: 'override',
          confidenceScore: 1.0,
          matchAlgorithm: 'override_mapping',
          status: 'approved',
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: explanation,
          matchedAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }

    // Step 2: Try deterministic matching
    const deterministicMatchResult = deterministicMatch(normalizedOffer, canonicalVehicles);
    if (deterministicMatchResult) {
      logger.debug('Found deterministic match', {
        offerId: normalizedOffer.supplierOfferId,
        vehicleId: deterministicMatchResult.id,
      });

      const explanation =
        'Deterministic match – exact (or near-exact) match on make, model, year (±1), and trim.';

      return {
        id: 0,
        normalizedOfferId,
        canonicalVehicleId: deterministicMatchResult.id,
        matchType: 'deterministic',
        confidenceScore: 1.0,
        matchAlgorithm: 'deterministic',
        status: 'approved',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: explanation,
        matchedAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Step 3: Try scored matching
    const scoredCandidates = scoredMatch(
      normalizedOffer,
      canonicalVehicles,
      config.matching.reviewThreshold
    );

    if (scoredCandidates.length === 0) {
      logger.debug('No match found', {
        offerId: normalizedOffer.supplierOfferId,
      });
      return null;
    }

    const bestMatch = scoredCandidates[0];
    const confidenceScore = bestMatch.score;

    // Determine status based on confidence threshold
    let status: MatchResult['status'] = 'pending';
    if (confidenceScore >= config.matching.confidenceThreshold) {
      status = 'approved';
    } else if (confidenceScore >= config.matching.reviewThreshold) {
      status = 'review';
    } else {
      // Below review threshold - no match
      return null;
    }

    logger.debug('Found scored match', {
      offerId: normalizedOffer.supplierOfferId,
      vehicleId: bestMatch.vehicle.id,
      score: confidenceScore,
      status,
    });

    const explanation =
      `Scored match – make ${bestMatch.components.make.toFixed(2)}, ` +
      `model ${bestMatch.components.model.toFixed(2)}, ` +
      `year ${bestMatch.components.year.toFixed(2)}, ` +
      `trim ${bestMatch.components.trim.toFixed(2)}, ` +
      `fuel ${bestMatch.components.fuelType.toFixed(2)}, ` +
      `transmission ${bestMatch.components.transmission.toFixed(2)}, ` +
      `power ${bestMatch.components.powerHp.toFixed(2)}, ` +
      `overall ${confidenceScore.toFixed(2)}`;

    return {
      id: 0,
      normalizedOfferId,
      canonicalVehicleId: bestMatch.vehicle.id,
      matchType: 'scored',
      confidenceScore,
      matchAlgorithm: 'scored_fuzzy',
      status,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: explanation,
      matchedAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    const matchingError = new MatchingError(
      `Failed to match offer: ${normalizedOffer.supplierOfferId}`,
      normalizedOffer.rawOfferId,
      error instanceof Error ? error : new Error(String(error))
    );
    logger.error('Matching failed', {
      supplierId: normalizedOffer.supplierId,
      offerId: normalizedOffer.supplierOfferId,
      error: matchingError.message,
    });
    throw matchingError;
  }
}

/**
 * Matches multiple normalized offers in batch.
 *
 * @param normalizedOffers - Array of normalized offers to match
 * @returns Array of match results (may be shorter than input if some don't match)
 */
export async function matchOffers(
  normalizedOffers: NormalizedOffer[]
): Promise<MatchResult[]> {
  logger.info('Matching offers in batch', { count: normalizedOffers.length });

  const matches: MatchResult[] = [];
  const errors: Array<{ offerId: string; error: string }> = [];

  for (const offer of normalizedOffers) {
    try {
      const match = await matchOffer(offer);
      if (match) {
        matches.push(match);
      }
    } catch (error) {
      errors.push({
        offerId: offer.supplierOfferId,
        error: error instanceof Error ? error.message : String(error),
      });
      logger.warn('Failed to match offer, skipping', {
        offerId: offer.supplierOfferId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Batch matching completed', {
    total: normalizedOffers.length,
    matched: matches.length,
    failed: errors.length,
  });

  return matches;
}
