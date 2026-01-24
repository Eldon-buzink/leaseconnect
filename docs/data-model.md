# Data Model

## Overview

The database schema is designed to support:
- Raw data retention (audit trail)
- Normalized data storage (performance)
- Match results (queryable)
- Override mappings (manual corrections)
- Incremental updates (idempotency)

## Core Tables

### `raw_offers`

Stores original supplier data exactly as received.

```sql
CREATE TABLE raw_offers (
  id SERIAL PRIMARY KEY,
  supplier_id VARCHAR(50) NOT NULL,
  supplier_offer_id VARCHAR(255) NOT NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ingestion_mode VARCHAR(20) NOT NULL, -- 'file' or 'api'
  raw_data JSONB NOT NULL, -- Original supplier data
  file_path VARCHAR(500), -- If ingested from file
  UNIQUE(supplier_id, supplier_offer_id, ingested_at)
);

CREATE INDEX idx_raw_offers_supplier ON raw_offers(supplier_id);
CREATE INDEX idx_raw_offers_ingested ON raw_offers(ingested_at);
CREATE INDEX idx_raw_offers_raw_data ON raw_offers USING GIN(raw_data);
```

**Purpose:**
- Audit trail of all received data
- Debugging and troubleshooting
- Reprocessing if normalization rules change

### `normalized_offers`

Stores cleaned and standardized offer data.

```sql
CREATE TABLE normalized_offers (
  id SERIAL PRIMARY KEY,
  raw_offer_id INTEGER NOT NULL REFERENCES raw_offers(id) ON DELETE CASCADE,
  supplier_id VARCHAR(50) NOT NULL,
  supplier_offer_id VARCHAR(255) NOT NULL,
  normalized_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Normalized fields
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
  
  -- Additional normalized fields (flexible)
  normalized_data JSONB,
  
  -- Status
  normalization_status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success', 'partial', 'failed'
  normalization_notes TEXT,
  
  UNIQUE(raw_offer_id)
);

CREATE INDEX idx_normalized_offers_supplier ON normalized_offers(supplier_id);
CREATE INDEX idx_normalized_offers_make_model ON normalized_offers(make, model);
CREATE INDEX idx_normalized_offers_year ON normalized_offers(year);
CREATE INDEX idx_normalized_offers_status ON normalized_offers(normalization_status);
```

**Purpose:**
- Fast querying for matching
- Standardized fields for comparison
- Tracks normalization quality

### `canonical_vehicles`

Reference table for Autodisk vehicle specifications (read-only, populated separately).

```sql
CREATE TABLE canonical_vehicles (
  id SERIAL PRIMARY KEY,
  autodisk_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Canonical fields
  make VARCHAR(100) NOT NULL,
  model VARCHAR(200) NOT NULL,
  trim VARCHAR(200),
  year INTEGER NOT NULL,
  fuel_type VARCHAR(50),
  transmission VARCHAR(50),
  doors INTEGER,
  seats INTEGER,
  engine_size DECIMAL(5,2),
  power_hp INTEGER,
  co2_emissions INTEGER,
  
  -- Full specification data
  specification JSONB,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_canonical_vehicles_make_model ON canonical_vehicles(make, model);
CREATE INDEX idx_canonical_vehicles_year ON canonical_vehicles(year);
CREATE INDEX idx_canonical_vehicles_autodisk_id ON canonical_vehicles(autodisk_id);
CREATE INDEX idx_canonical_vehicles_active ON canonical_vehicles(is_active);
```

**Purpose:**
- Single source of truth for vehicle specs
- Populated from Autodisk (separate process)
- Used for matching against supplier offers

### `matches`

Stores match results between normalized offers and canonical vehicles.

```sql
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  normalized_offer_id INTEGER NOT NULL REFERENCES normalized_offers(id) ON DELETE CASCADE,
  canonical_vehicle_id INTEGER NOT NULL REFERENCES canonical_vehicles(id),
  
  -- Matching metadata
  match_type VARCHAR(20) NOT NULL, -- 'deterministic', 'scored', 'override'
  confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
  match_algorithm VARCHAR(50), -- Algorithm used
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'review'
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Timestamps
  matched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(normalized_offer_id)
);

CREATE INDEX idx_matches_canonical_vehicle ON matches(canonical_vehicle_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_confidence ON matches(confidence_score);
CREATE INDEX idx_matches_review ON matches(status, confidence_score) WHERE status = 'review';
```

**Purpose:**
- Links supplier offers to canonical vehicles
- Tracks match confidence and review status
- Supports querying matched data

### `override_mappings`

Manual mappings for known edge cases.

```sql
CREATE TABLE override_mappings (
  id SERIAL PRIMARY KEY,
  supplier_id VARCHAR(50) NOT NULL,
  supplier_make VARCHAR(100),
  supplier_model VARCHAR(200),
  supplier_trim VARCHAR(200),
  supplier_year INTEGER,
  
  -- Target canonical vehicle
  canonical_vehicle_id INTEGER NOT NULL REFERENCES canonical_vehicles(id),
  
  -- Metadata
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  
  UNIQUE(supplier_id, supplier_make, supplier_model, supplier_trim, supplier_year)
);

CREATE INDEX idx_override_mappings_supplier ON override_mappings(supplier_id);
CREATE INDEX idx_override_mappings_active ON override_mappings(is_active);
```

**Purpose:**
- Manual corrections for known mismatches
- Handles edge cases that algorithms can't solve
- Supplier-specific mappings

## Relationships

```
raw_offers (1) ──→ (1) normalized_offers (1) ──→ (1) matches (N) ──→ (1) canonical_vehicles
                                                      ↑
                                                      │
                                            override_mappings (N) ──→ (1) canonical_vehicles
```

## Key Design Decisions

### 1. Raw Data Retention

**Decision:** Store all raw supplier data in `raw_offers`.

**Rationale:**
- Audit trail for compliance
- Ability to reprocess if normalization rules change
- Debugging and troubleshooting
- No data loss

### 2. Normalized Data Separation

**Decision:** Store normalized data in separate table.

**Rationale:**
- Performance (indexed normalized fields)
- Clear separation of concerns
- Can rebuild normalization without losing raw data

### 3. One-to-One Match

**Decision:** Each normalized offer maps to exactly one canonical vehicle (via `matches`).

**Rationale:**
- Simplifies queries
- Clear business rule: one offer = one vehicle
- If multiple matches found, highest confidence wins

### 4. Override Mappings

**Decision:** Separate table for manual overrides.

**Rationale:**
- Easy to manage and audit
- Can be applied before algorithmic matching
- Supplier-specific rules

## Indexes

Indexes are designed for common query patterns:

1. **Supplier lookups**: `idx_raw_offers_supplier`, `idx_normalized_offers_supplier`
2. **Matching queries**: `idx_normalized_offers_make_model`, `idx_canonical_vehicles_make_model`
3. **Review queue**: `idx_matches_review` (filtered index on status='review')
4. **Full-text search**: GIN indexes on JSONB columns for flexible queries

## Future Considerations

### Multi-Tenant Support

If multi-tenancy is needed:
- Add `tenant_id` column to all tables
- Add tenant_id to all indexes
- Enforce tenant isolation in application layer

### Price History

If price tracking is needed:
- Add `prices` table with `normalized_offer_id`, `price`, `currency`, `valid_from`, `valid_to`
- Link to `normalized_offers` for historical pricing

### Versioning

If schema versioning is needed:
- Add `schema_version` column to `raw_offers`
- Track normalization rule versions
- Support reprocessing with different rule versions

