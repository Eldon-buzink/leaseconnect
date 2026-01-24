/**
 * JSON export module.
 * Exports match results to JSON Lines (NDJSON) format.
 *
 * TODO: Implement actual JSON writing
 * - Write as JSON Lines (one JSON object per line)
 * - Support pretty-printed option
 * - Include enriched data (canonical vehicle, supplier offer)
 * - Support filtering options
 */

import { MatchResult } from '../domain/types';
import { logger } from '../utils/logger';
import { ExportError } from '../utils/errors';
import { writeFile } from 'fs/promises';

export interface JsonExportOptions {
  pretty?: boolean;
}

/**
 * Exports match results to JSON Lines file.
 *
 * @param matches - Array of match results to export
 * @param outputPath - Path to output JSON file
 * @param options - Export options (pretty printing, etc.)
 * @throws {ExportError} If export fails
 */
export async function exportJson(
  matches: MatchResult[],
  outputPath: string,
  options?: JsonExportOptions
): Promise<void> {
  logger.info('Exporting matches to JSON', {
    matchCount: matches.length,
    outputPath,
    pretty: options?.pretty || false,
  });

  try {
    // TODO: Implement JSON writing
    // 1. Format matches as JSON objects
    // 2. Include enriched data (canonical vehicle, supplier offer)
    // 3. Write as JSON Lines (one object per line) or pretty-printed JSON array
    // 4. Handle circular references if any

    // Placeholder: Write simple JSON Lines
    const exportData = matches.map((match) => ({
      match_id: match.id,
      matched_at: match.matchedAt.toISOString(),
      confidence_score: match.confidenceScore,
      match_type: match.matchType,
      status: match.status,
      canonical_vehicle: match.canonicalVehicle
        ? {
            id: match.canonicalVehicle.id,
            autodisk_id: match.canonicalVehicle.autodiskId,
            make: match.canonicalVehicle.make,
            model: match.canonicalVehicle.model,
            trim: match.canonicalVehicle.trim,
            year: match.canonicalVehicle.year,
            fuel_type: match.canonicalVehicle.fuelType,
            transmission: match.canonicalVehicle.transmission,
            doors: match.canonicalVehicle.doors,
            seats: match.canonicalVehicle.seats,
            engine_size: match.canonicalVehicle.engineSize,
            power_hp: match.canonicalVehicle.powerHp,
            co2_emissions: match.canonicalVehicle.co2Emissions,
            specification: match.canonicalVehicle.specification,
          }
        : null,
      supplier_offer: match.normalizedOffer
        ? {
            supplier_id: match.normalizedOffer.supplierId,
            supplier_offer_id: match.normalizedOffer.supplierOfferId,
            make: match.normalizedOffer.make,
            model: match.normalizedOffer.model,
            trim: match.normalizedOffer.trim,
            year: match.normalizedOffer.year,
            fuel_type: match.normalizedOffer.fuelType,
            transmission: match.normalizedOffer.transmission,
            doors: match.normalizedOffer.doors,
            seats: match.normalizedOffer.seats,
            engine_size: match.normalizedOffer.engineSize,
            power_hp: match.normalizedOffer.powerHp,
            co2_emissions: match.normalizedOffer.co2Emissions,
            price: match.normalizedOffer.price,
            currency: match.normalizedOffer.currency,
          }
        : null,
    }));

    let jsonContent: string;
    if (options?.pretty) {
      // Pretty-printed JSON array
      jsonContent = JSON.stringify(exportData, null, 2);
    } else {
      // JSON Lines (one object per line)
      jsonContent = exportData.map((obj) => JSON.stringify(obj)).join('\n');
    }

    await writeFile(outputPath, jsonContent, 'utf-8');

    logger.info('JSON export completed', {
      outputPath,
      rowCount: matches.length,
      format: options?.pretty ? 'pretty' : 'jsonl',
    });
  } catch (error) {
    const exportError = new ExportError(
      `Failed to export JSON: ${outputPath}`,
      'json',
      error instanceof Error ? error : new Error(String(error))
    );
    logger.error('JSON export failed', {
      outputPath,
      error: exportError.message,
    });
    throw exportError;
  }
}

