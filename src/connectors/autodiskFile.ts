/**
 * File connector for Autodisk canonical vehicle data.
 * Parses CSV file and loads into canonical_vehicles table.
 */

import { parse } from 'csv-parse/sync';
import { readFile } from 'fs/promises';
import { CanonicalVehicle } from '../domain/types';
import { logger } from '../utils/logger';
import { IngestionError } from '../utils/errors';

/**
 * Loads canonical vehicles from Autodisk CSV file.
 *
 * @param filePath - Path to Autodisk CSV file
 * @returns Array of canonical vehicles
 */
export async function loadAutodiskFile(filePath: string): Promise<CanonicalVehicle[]> {
  logger.info('Loading Autodisk canonical vehicles', { filePath });

  try {
    let fileContent = await readFile(filePath, 'utf-8');
    
    logger.debug('File read successfully', { fileSize: fileContent.length });

    // Handle CSV format where entire rows are quoted
    // Remove outer quotes from each line and handle escaped quotes
    const lines = fileContent.split('\n');
    const processedLines = lines.map((line) => {
      line = line.trim();
      if (line.startsWith('"') && line.endsWith('"')) {
        // Remove outer quotes
        line = line.slice(1, -1);
        // Replace double quotes with single quotes for parsing
        line = line.replace(/""/g, '"');
      }
      return line;
    });
    fileContent = processedLines.join('\n');

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      quote: '"',
      escape: '"',
    });

    logger.info('Parsed Autodisk CSV', { recordCount: records.length });
    
    if (records.length === 0) {
      throw new Error('No records found in CSV file');
    }

    const vehicles: CanonicalVehicle[] = [];

    for (const record of records as Record<string, string>[]) {
      // Parse manufacturer name (make) - truncate to 100 chars
      const make = (record.manufacturerName?.toLowerCase().trim() || '').substring(0, 100);
      const model = (record.name?.toLowerCase().trim() || '').substring(0, 200);
      const trim = record.version ? (record.version.toLowerCase().trim().substring(0, 200)) : null;
      const year = parseInt(record.year, 10) || null;
      const fuelType = normalizeFuelType(record.fuel);
      const transmission = normalizeTransmission(record.transmission);
      const doors = parseInt(record.nrOfDoors, 10) || null;

      // Extract power from version field (e.g., "ev 114kW aut" -> 114)
      const powerHp = extractPower(record.version);

      // Extract engine size if available
      const engineSize = extractEngineSize(record.engine);

      const vehicle: CanonicalVehicle = {
        id: 0, // Will be set by database
        autodiskId: record.vehicle_autodisk_id || '',
        make,
        model,
        trim,
        year: year || 0, // Default to 0 if null, but should not happen
        fuelType,
        transmission,
        doors,
        seats: null, // Not in CSV
        engineSize,
        powerHp,
        co2Emissions: null, // Not in CSV
        specification: {
          vehicle_autodisk_id: record.vehicle_autodisk_id,
          vehicle_autodisk_historic_id: record.vehicle_autodisk_historic_id,
          model_autodisk_id: record.model_autodisk_id,
          make_autodisk_id: record.make_autodisk_id,
          engine: record.engine,
          listingPrice: record.listingPrice,
          bodywork: record.bodywork,
          internal_vehicle_uuid: record.internal_vehicle_uuid,
        },
        isActive: record.isUpToDate === '1',
      };

      vehicles.push(vehicle);
    }

    logger.info('Loaded canonical vehicles', { count: vehicles.length });

    // Store in database
    await storeCanonicalVehicles(vehicles);

    return vehicles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Autodisk file loading failed', {
      filePath,
      error: errorMessage,
      stack: errorStack,
    });
    
    const ingestionError = new IngestionError(
      `Failed to load Autodisk file: ${filePath} - ${errorMessage}`,
      'autodisk',
      error instanceof Error ? error : new Error(String(error))
    );
    throw ingestionError;
  }
}

/**
 * Store canonical vehicles in database.
 */
async function storeCanonicalVehicles(vehicles: CanonicalVehicle[]): Promise<void> {
  const { getSupabaseClient } = await import('../utils/supabase');
  const supabase = getSupabaseClient();

  logger.info('Storing canonical vehicles in database', { count: vehicles.length });

  // Deduplicate by autodisk_id (keep first occurrence)
  const uniqueVehicles = new Map<string, CanonicalVehicle>();
  for (const vehicle of vehicles) {
    if (!uniqueVehicles.has(vehicle.autodiskId)) {
      uniqueVehicles.set(vehicle.autodiskId, vehicle);
    }
  }
  
  const deduplicatedVehicles = Array.from(uniqueVehicles.values());
  logger.info('Deduplicated vehicles', { 
    original: vehicles.length, 
    unique: deduplicatedVehicles.length 
  });

  // Insert in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < deduplicatedVehicles.length; i += batchSize) {
    const batch = deduplicatedVehicles.slice(i, i + batchSize);
    const rows = batch.map((v) => ({
      autodisk_id: v.autodiskId.substring(0, 100), // Ensure within limit
      make: v.make.substring(0, 100),
      model: v.model.substring(0, 200),
      trim: v.trim ? v.trim.substring(0, 200) : null,
      year: v.year || 0, // Ensure not null
      fuel_type: v.fuelType ? v.fuelType.substring(0, 50) : null,
      transmission: v.transmission ? v.transmission.substring(0, 50) : null,
      nr_of_doors: v.doors,
      engine_size: v.engineSize,
      power_hp: v.powerHp,
      specification: v.specification,
      is_active: v.isActive,
    }));

    const { error } = await supabase.from('canonical_vehicles').upsert(rows, {
      onConflict: 'autodisk_id',
    });

    if (error) {
      logger.error('Failed to store canonical vehicles batch', {
        batchStart: i,
        batchSize: batch.length,
        error: error.message,
      });
      throw error;
    }

    logger.info('Stored canonical vehicles batch', {
      batchStart: i,
      batchSize: batch.length,
    });
  }
}

/**
 * Normalize fuel type from Autodisk format.
 */
function normalizeFuelType(fuel: string | undefined): string | null {
  if (!fuel) return null;
  const normalized = fuel.toLowerCase().trim();
  if (normalized.includes('elektrisch') || normalized.includes('electric')) return 'electric';
  if (normalized.includes('benzine') || normalized.includes('petrol')) return 'petrol';
  if (normalized.includes('diesel')) return 'diesel';
  if (normalized.includes('hybrid')) return 'hybrid';
  return normalized;
}

/**
 * Normalize transmission type.
 */
function normalizeTransmission(transmission: string | undefined): string | null {
  if (!transmission) return null;
  const normalized = transmission.toLowerCase().trim();
  if (normalized.includes('automaat') || normalized.includes('automatic')) return 'automatic';
  if (normalized.includes('manual')) return 'manual';
  return normalized;
}

/**
 * Extract power in HP from version string (e.g., "ev 114kW aut" -> 114).
 */
function extractPower(version: string | undefined): number | null {
  if (!version) return null;
  const match = version.match(/(\d+)\s*kw/i);
  if (match) {
    const kw = parseInt(match[1], 10);
    // Convert kW to HP (approximately)
    return Math.round(kw * 1.341);
  }
  return null;
}

/**
 * Extract engine size from engine string (e.g., "2.0gme" -> 2.0).
 */
function extractEngineSize(engine: string | undefined): number | null {
  if (!engine) return null;
  const match = engine.match(/(\d+\.?\d*)\s*(l|liter|gme|jtd)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

