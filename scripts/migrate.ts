#!/usr/bin/env tsx

/**
 * Database migration script for Supabase.
 * Creates all required tables and indexes.
 *
 * Run with: npm run migrate
 */

import { getSupabaseClient } from '../src/utils/supabase';
import { logger } from '../src/utils/logger';

async function migrate() {
  logger.info('Starting database migration');

  const supabase = getSupabaseClient();

  // SQL migration script
  const migrations = [
    // Raw offers table
    `
    CREATE TABLE IF NOT EXISTS raw_offers (
      id BIGSERIAL PRIMARY KEY,
      supplier_id VARCHAR(50) NOT NULL,
      supplier_offer_id VARCHAR(255) NOT NULL,
      ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ingestion_mode VARCHAR(20) NOT NULL,
      raw_data JSONB NOT NULL,
      file_path VARCHAR(500),
      UNIQUE(supplier_id, supplier_offer_id, ingested_at)
    );
    `,

    // Indexes for raw_offers
    `CREATE INDEX IF NOT EXISTS idx_raw_offers_supplier ON raw_offers(supplier_id);`,
    `CREATE INDEX IF NOT EXISTS idx_raw_offers_ingested ON raw_offers(ingested_at);`,
    `CREATE INDEX IF NOT EXISTS idx_raw_offers_raw_data ON raw_offers USING GIN(raw_data);`,

    // Normalized offers table
    `
    CREATE TABLE IF NOT EXISTS normalized_offers (
      id BIGSERIAL PRIMARY KEY,
      raw_offer_id BIGINT NOT NULL REFERENCES raw_offers(id) ON DELETE CASCADE,
      supplier_id VARCHAR(50) NOT NULL,
      supplier_offer_id VARCHAR(255) NOT NULL,
      normalized_at TIMESTAMP NOT NULL DEFAULT NOW(),
      make VARCHAR(100),
      model VARCHAR(200),
      trim VARCHAR(200),
      year INTEGER,
      fuel_type VARCHAR(50),
      transmission VARCHAR(50),
      doors INTEGER,
      seats INTEGER,
      engine_size DECIMAL(5,2),
      power_hp INTEGER,
      co2_emissions INTEGER,
      normalization_status VARCHAR(20) NOT NULL DEFAULT 'success',
      normalization_notes TEXT,
      UNIQUE(raw_offer_id)
    );
    `,

    // Indexes for normalized_offers
    `CREATE INDEX IF NOT EXISTS idx_normalized_offers_supplier ON normalized_offers(supplier_id);`,
    `CREATE INDEX IF NOT EXISTS idx_normalized_offers_make_model ON normalized_offers(make, model);`,
    `CREATE INDEX IF NOT EXISTS idx_normalized_offers_year ON normalized_offers(year);`,
    `CREATE INDEX IF NOT EXISTS idx_normalized_offers_status ON normalized_offers(normalization_status);`,

    // Canonical vehicles table
    `
    CREATE TABLE IF NOT EXISTS canonical_vehicles (
      id BIGSERIAL PRIMARY KEY,
      autodisk_id VARCHAR(100) UNIQUE NOT NULL,
      make VARCHAR(100) NOT NULL,
      model VARCHAR(200) NOT NULL,
      trim VARCHAR(200),
      year INTEGER NOT NULL,
      fuel_type VARCHAR(50),
      transmission VARCHAR(50),
      nr_of_doors INTEGER,
      engine_size DECIMAL(5,2),
      power_hp INTEGER,
      specification JSONB,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    `,

    // Indexes for canonical_vehicles
    `CREATE INDEX IF NOT EXISTS idx_canonical_vehicles_make_model ON canonical_vehicles(make, model);`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_vehicles_year ON canonical_vehicles(year);`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_vehicles_autodisk_id ON canonical_vehicles(autodisk_id);`,
    `CREATE INDEX IF NOT EXISTS idx_canonical_vehicles_active ON canonical_vehicles(is_active);`,

    // Matches table
    `
    CREATE TABLE IF NOT EXISTS matches (
      id BIGSERIAL PRIMARY KEY,
      normalized_offer_id BIGINT NOT NULL REFERENCES normalized_offers(id) ON DELETE CASCADE,
      canonical_vehicle_id BIGINT NOT NULL REFERENCES canonical_vehicles(id),
      match_type VARCHAR(20) NOT NULL,
      confidence_score DECIMAL(5,4),
      match_algorithm VARCHAR(50),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMP,
      review_notes TEXT,
      matched_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(normalized_offer_id)
    );
    `,

    // Indexes for matches
    `CREATE INDEX IF NOT EXISTS idx_matches_canonical_vehicle ON matches(canonical_vehicle_id);`,
    `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);`,
    `CREATE INDEX IF NOT EXISTS idx_matches_confidence ON matches(confidence_score);`,
    `CREATE INDEX IF NOT EXISTS idx_matches_review ON matches(status, confidence_score) WHERE status = 'review';`,

    // Override mappings table
    `
    CREATE TABLE IF NOT EXISTS override_mappings (
      id BIGSERIAL PRIMARY KEY,
      supplier_id VARCHAR(50) NOT NULL,
      supplier_make VARCHAR(100),
      supplier_model VARCHAR(200),
      supplier_trim VARCHAR(200),
      supplier_year INTEGER,
      canonical_vehicle_id BIGINT NOT NULL REFERENCES canonical_vehicles(id),
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      UNIQUE(supplier_id, supplier_make, supplier_model, supplier_trim, supplier_year)
    );
    `,

    // Indexes for override_mappings
    `CREATE INDEX IF NOT EXISTS idx_override_mappings_supplier ON override_mappings(supplier_id);`,
    `CREATE INDEX IF NOT EXISTS idx_override_mappings_active ON override_mappings(is_active);`,
  ];

  // Execute migrations using RPC (if available) or direct SQL
  // Note: Supabase doesn't support direct SQL execution via client
  // We'll need to run these via Supabase SQL editor or use a migration tool

  logger.warn(
    'Supabase client does not support direct SQL execution. Please run these migrations in Supabase SQL Editor:'
  );
  logger.info('Migration SQL:');
  console.log('\n' + '='.repeat(80));
  migrations.forEach((sql, index) => {
    console.log(`\n-- Migration ${index + 1}`);
    console.log(sql);
  });
  console.log('\n' + '='.repeat(80));

  logger.info(
    'To apply migrations:\n1. Go to your Supabase project dashboard\n2. Navigate to SQL Editor\n3. Copy and paste the SQL above\n4. Run the queries'
  );
}

migrate().catch((error) => {
  logger.error('Migration failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

