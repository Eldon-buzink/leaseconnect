/**
 * File-based connector for Athlon supplier.
 * Parses XLSX files and returns RawSupplierOffer[].
 */

import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import { RawSupplierOffer } from '../domain/types';
import { logger } from '../utils/logger';
import { IngestionError } from '../utils/errors';

/**
 * Ingests offers from an Athlon XLSX file.
 *
 * @param filePath - Path to the XLSX file to ingest
 * @returns Array of raw supplier offers
 * @throws {IngestionError} If file cannot be read or parsed
 */
export async function ingestAthlonFile(filePath: string): Promise<RawSupplierOffer[]> {
  logger.info('Starting Athlon file ingestion', { filePath });

  try {
    // Read XLSX file
    const fileBuffer = await readFile(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      throw new Error(`No worksheet found in file: ${filePath}`);
    }

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false });

    logger.info('Parsed Athlon XLSX', {
      sheetName,
      rowCount: rows.length,
    });

    // Map rows to RawSupplierOffer
    const offers: RawSupplierOffer[] = [];

    for (const row of rows as Record<string, unknown>[]) {
      try {
        const offer = mapAthlonRowToOffer(row);
        offers.push(offer);
      } catch (error) {
        logger.warn('Failed to parse Athlon row, skipping', {
          row: JSON.stringify(row).substring(0, 100),
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing other rows
      }
    }

    logger.info('Athlon file ingestion completed', {
      filePath,
      offerCount: offers.length,
    });

    return offers;
  } catch (error) {
    const ingestionError = new IngestionError(
      `Failed to ingest Athlon file: ${filePath}`,
      'athlon',
      error instanceof Error ? error : new Error(String(error))
    );
    logger.error('Athlon file ingestion failed', {
      filePath,
      error: ingestionError.message,
    });
    throw ingestionError;
  }
}

/**
 * Maps an Athlon XLSX row to RawSupplierOffer.
 * Adjust column names based on actual Athlon file structure.
 */
function mapAthlonRowToOffer(row: Record<string, unknown>): RawSupplierOffer {
  // Common column name variations - adjust based on actual file
  const getField = (possibleNames: string[]): string | null => {
    for (const name of possibleNames) {
      const value = row[name];
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim();
      }
    }
    return null;
  };

  const make = getField(['Make', 'make', 'Merk', 'merk', 'Brand', 'brand']);
  const model = getField(['Model', 'model', 'Type', 'type']);
  const trim = getField(['Trim', 'trim', 'Version', 'version', 'Uitvoering', 'uitvoering']);
  const yearStr = getField(['Year', 'year', 'Jaar', 'jaar', 'Bouwjaar', 'bouwjaar']);
  const fuelType = getField(['Fuel', 'fuel', 'Brandstof', 'brandstof', 'Fuel Type', 'fuelType']);
  const transmission = getField(['Transmission', 'transmission', 'Transmissie', 'transmissie']);
  const doorsStr = getField(['Doors', 'doors', 'Deuren', 'deuren']);
  const seatsStr = getField(['Seats', 'seats', 'Zitplaatsen', 'zitplaatsen']);
  const priceStr = getField(['Price', 'price', 'Prijs', 'prijs', 'List Price', 'listPrice']);
  const currency = getField(['Currency', 'currency', 'Valuta', 'valuta']) || 'EUR';

  // Parse numeric fields
  const year = yearStr ? parseInt(yearStr, 10) : null;
  const doors = doorsStr ? parseInt(doorsStr, 10) : null;
  const seats = seatsStr ? parseInt(seatsStr, 10) : null;
  const price = priceStr ? parseFloat(String(priceStr).replace(/[^\d.-]/g, '')) : null;

  // Extract additional fields (all other fields)
  const additionalFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      !['Make', 'make', 'Model', 'model', 'Trim', 'trim', 'Year', 'year', 'Fuel', 'fuel'].includes(
        key
      )
    ) {
      additionalFields[key] = value;
    }
  }

  return {
    supplierId: 'athlon',
    supplierOfferId: getField(['ID', 'id', 'Vehicle ID', 'vehicleId', 'Offer ID', 'offerId']) || `ATH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    make,
    model,
    trim,
    year,
    fuelType,
    transmission,
    doors,
    seats,
    engineSize: null, // Extract from additional fields if available
    powerHp: null, // Extract from additional fields if available
    co2Emissions: null, // Extract from additional fields if available
    price,
    currency,
    additionalFields,
    receivedAt: new Date(),
  };
}
