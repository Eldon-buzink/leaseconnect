/**
 * Connector registry.
 * Maps supplier IDs to their file and API connectors.
 */

import { ingestAthlonFile } from './athlonFile';
import { ingestAthlonApi } from './athlonApi';
import { RawSupplierOffer, ApiConfig } from '../domain/types';

export type FileConnector = (filePath: string) => Promise<RawSupplierOffer[]>;
export type ApiConnector = (config?: ApiConfig) => Promise<RawSupplierOffer[]>;

export interface SupplierConnectors {
  file: FileConnector | null;
  api: ApiConnector | null;
}

export const connectors: Record<string, SupplierConnectors> = {
  athlon: {
    file: ingestAthlonFile,
    api: ingestAthlonApi,
  },
  // Add more suppliers here as they are implemented
};

/**
 * Get connectors for a supplier.
 *
 * @param supplierId - Supplier identifier
 * @returns Connectors for the supplier, or null if supplier not found
 */
export function getConnectors(supplierId: string): SupplierConnectors | null {
  return connectors[supplierId] || null;
}

