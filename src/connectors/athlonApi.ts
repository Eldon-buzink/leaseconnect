/**
 * API-based connector for Athlon supplier.
 * Fetches data from Athlon API and returns RawSupplierOffer[].
 *
 * TODO: Implement actual API integration
 * - Authenticate with Athlon API
 * - Fetch offer data (handle pagination)
 * - Map API response to RawSupplierOffer format
 * - Handle rate limiting and retries
 * - Handle API errors gracefully
 */

import { RawSupplierOffer, ApiConfig } from '../domain/types';
import { logger } from '../utils/logger';
import { IngestionError } from '../utils/errors';
import { config } from '../utils/config';

/**
 * Ingests offers from Athlon API.
 *
 * @param apiConfig - API configuration (optional, uses config from env if not provided)
 * @returns Array of raw supplier offers
 * @throws {IngestionError} If API call fails
 */
export async function ingestAthlonApi(apiConfig?: ApiConfig): Promise<RawSupplierOffer[]> {
  logger.info('Starting Athlon API ingestion');

  try {
    // TODO: Implement API integration
    // 1. Get API credentials from config or apiConfig parameter
    // 2. Authenticate with API (if needed)
    // 3. Fetch offers (handle pagination if needed)
    // 4. Map API response to RawSupplierOffer format
    // 5. Handle rate limiting (exponential backoff)
    // 6. Handle API errors (401, 403, 429, 500)

    const effectiveConfig = apiConfig || {
      url: config.suppliers.athlon.apiUrl || 'https://api.athlon.example.com',
      apiKey: config.suppliers.athlon.apiKey,
    };

    logger.warn('Using placeholder data - API integration not yet implemented', {
      apiUrl: effectiveConfig.url,
    });

    // Placeholder: Return dummy data for now
    const dummyOffers: RawSupplierOffer[] = [
      {
        supplierId: 'athlon',
        supplierOfferId: 'ATH-API-001',
        make: 'Mercedes-Benz',
        model: 'E-Class',
        trim: 'E200',
        year: 2024,
        fuelType: 'Petrol',
        transmission: 'Automatic',
        doors: 4,
        seats: 5,
        engineSize: 2.0,
        powerHp: 197,
        co2Emissions: 145,
        price: 55000,
        currency: 'EUR',
        additionalFields: {},
        receivedAt: new Date(),
      },
    ];

    logger.info('Athlon API ingestion completed', {
      offerCount: dummyOffers.length,
    });

    return dummyOffers;
  } catch (error) {
    const ingestionError = new IngestionError(
      'Failed to ingest from Athlon API',
      'athlon',
      error instanceof Error ? error : new Error(String(error))
    );
    logger.error('Athlon API ingestion failed', {
      error: ingestionError.message,
    });
    throw ingestionError;
  }
}

