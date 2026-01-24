/**
 * Domain types and interfaces for the Leaseconnect system.
 * These types define the contracts between different layers of the application.
 */

/**
 * Raw supplier offer as received from supplier (file or API).
 * This is the initial data structure before any normalization.
 */
export interface RawSupplierOffer {
  /** Unique identifier for the supplier (e.g., 'athlon', 'leaseplan') */
  supplierId: string;
  /** Supplier's internal offer ID */
  supplierOfferId: string;
  /** Vehicle make (as provided by supplier) */
  make: string | null;
  /** Vehicle model (as provided by supplier) */
  model: string | null;
  /** Vehicle trim/version (as provided by supplier) */
  trim: string | null;
  /** Vehicle year */
  year: number | null;
  /** Fuel type (petrol, diesel, electric, etc.) */
  fuelType: string | null;
  /** Transmission type (manual, automatic, etc.) */
  transmission: string | null;
  /** Number of doors */
  doors: number | null;
  /** Number of seats */
  seats: number | null;
  /** Engine size in liters */
  engineSize: number | null;
  /** Power in horsepower */
  powerHp: number | null;
  /** CO2 emissions in g/km */
  co2Emissions: number | null;
  /** Price (if available) */
  price: number | null;
  /** Currency code (EUR, USD, etc.) */
  currency: string | null;
  /** Any additional fields from supplier (stored as key-value pairs) */
  additionalFields: Record<string, unknown>;
  /** Timestamp when offer was received */
  receivedAt: Date;
}

/**
 * Normalized offer after applying standardization rules.
 * Fields are cleaned and standardized for matching.
 */
export interface NormalizedOffer {
  /** Reference to original raw offer */
  rawOfferId: number;
  /** Supplier ID */
  supplierId: string;
  /** Supplier's offer ID */
  supplierOfferId: string;
  /** Normalized make (lowercase, standardized) */
  make: string | null;
  /** Normalized model (lowercase, standardized) */
  model: string | null;
  /** Normalized trim (lowercase, standardized) */
  trim: string | null;
  /** Vehicle year */
  year: number | null;
  /** Normalized fuel type */
  fuelType: string | null;
  /** Normalized transmission type */
  transmission: string | null;
  /** Number of doors */
  doors: number | null;
  /** Number of seats */
  seats: number | null;
  /** Engine size in liters */
  engineSize: number | null;
  /** Power in horsepower */
  powerHp: number | null;
  /** CO2 emissions in g/km */
  co2Emissions: number | null;
  /** Price */
  price: number | null;
  /** Currency code */
  currency: string | null;
  /** Normalization status */
  normalizationStatus: 'success' | 'partial' | 'failed';
  /** Notes about normalization (warnings, issues) */
  normalizationNotes: string | null;
  /** Timestamp when normalization occurred */
  normalizedAt: Date;
}

/**
 * Canonical vehicle specification from Autodisk.
 * This is the reference data used for matching.
 */
export interface CanonicalVehicle {
  /** Database ID */
  id: number;
  /** Autodisk's internal vehicle ID */
  autodiskId: string;
  /** Canonical make */
  make: string;
  /** Canonical model */
  model: string;
  /** Canonical trim */
  trim: string | null;
  /** Vehicle year */
  year: number;
  /** Fuel type */
  fuelType: string | null;
  /** Transmission type */
  transmission: string | null;
  /** Number of doors */
  doors: number | null;
  /** Number of seats */
  seats: number | null;
  /** Engine size in liters */
  engineSize: number | null;
  /** Power in horsepower */
  powerHp: number | null;
  /** CO2 emissions in g/km */
  co2Emissions: number | null;
  /** Full specification JSON */
  specification: Record<string, unknown>;
  /** Whether vehicle is active in system */
  isActive: boolean;
}

/**
 * Result of matching a normalized offer to a canonical vehicle.
 */
export interface MatchResult {
  /** Match database ID */
  id: number;
  /** Reference to normalized offer */
  normalizedOfferId: number;
  /** Reference to canonical vehicle */
  canonicalVehicleId: number;
  /** Type of match */
  matchType: 'deterministic' | 'scored' | 'override';
  /** Confidence score (0.0 to 1.0) */
  confidenceScore: number;
  /** Algorithm used for matching */
  matchAlgorithm: string | null;
  /** Match status */
  status: 'pending' | 'approved' | 'rejected' | 'review';
  /** Who reviewed the match (if reviewed) */
  reviewedBy: string | null;
  /** When match was reviewed (if reviewed) */
  reviewedAt: Date | null;
  /** Review notes */
  reviewNotes: string | null;
  /** When match was created */
  matchedAt: Date;
  /** When match was last updated */
  updatedAt: Date;
  /** Canonical vehicle data (enriched) */
  canonicalVehicle?: CanonicalVehicle;
  /** Normalized offer data (enriched) */
  normalizedOffer?: NormalizedOffer;
}

/**
 * Configuration for API-based ingestion.
 */
export interface ApiConfig {
  /** API endpoint URL */
  url: string;
  /** API key or token */
  apiKey?: string;
  /** Authentication type */
  authType?: 'api_key' | 'oauth' | 'basic';
  /** Additional headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Export options for generating output files.
 */
export interface ExportOptions {
  /** Output format */
  format: 'csv' | 'json';
  /** Filter by supplier ID */
  supplierId?: string;
  /** Filter by match status */
  status?: MatchResult['status'];
  /** Minimum confidence score */
  minConfidence?: number;
  /** Start date (inclusive) */
  fromDate?: Date;
  /** End date (inclusive) */
  toDate?: Date;
}

/**
 * Result type for operations that can fail.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

