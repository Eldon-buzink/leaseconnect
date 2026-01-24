# Matching Strategy

## Overview

The matching system connects supplier offers to canonical vehicle specifications from Autodisk. It uses a multi-stage approach: deterministic matching first, then scored matching, with override mappings taking precedence.

## Matching Pipeline

```
NormalizedOffer
    │
    ├─→ Check Override Mappings ──→ Match Found? ──→ Return MatchResult (type: 'override')
    │
    ├─→ Deterministic Matching ──→ Exact Match? ──→ Return MatchResult (type: 'deterministic')
    │
    └─→ Scored Matching ──→ Score ≥ Threshold? ──→ Return MatchResult (type: 'scored')
                                                      │
                                                      └─→ Score < Threshold? ──→ Return MatchResult (status: 'review')
```

## Normalization Rules

Before matching, supplier data must be normalized to a standard format.

### Make Normalization

**Rules:**
- Convert to lowercase
- Remove special characters (except spaces and hyphens)
- Standardize abbreviations:
  - "VW" → "volkswagen"
  - "BMW" → "bmw" (already standard)
  - "Mercedes-Benz" → "mercedes-benz"
  - "Mercedes" → "mercedes-benz"
- Remove common suffixes: "Group", "AG", "Inc"

**Example:**
```
"VW" → "volkswagen"
"Mercedes-Benz" → "mercedes-benz"
"BMW Group" → "bmw"
```

### Model Normalization

**Rules:**
- Convert to lowercase
- Remove special characters (normalize dots, dashes, spaces)
- Standardize separators: use single space
- Remove version suffixes: "Pro", "Plus", "Max" (keep in trim)
- Handle common variations:
  - "ID4" → "id.4"
  - "ID.4" → "id.4"
  - "ID 4" → "id.4"

**Example:**
```
"VW ID4" → "id.4" (make: "volkswagen")
"Volkswagen ID.4" → "id.4" (make: "volkswagen")
"BMW 3 Series" → "3 series"
```

### Trim Normalization

**Rules:**
- Convert to lowercase
- Normalize separators: "GT-X" → "gtx", "GT X" → "gtx"
- Remove spaces and hyphens
- Standardize common terms:
  - "Pro" → "pro"
  - "Plus" → "plus"
  - "Max" → "max"
  - "GT" → "gt"
  - "GTE" → "gte"

**Example:**
```
"GT-X" → "gtx"
"GT X" → "gtx"
"Pro Max" → "promax"
```

### Year Normalization

**Rules:**
- Extract 4-digit year from string if present
- Default to current year if missing
- Validate range: 1900 to current year + 1

### Fuel Type Normalization

**Rules:**
- Standardize to: "petrol", "diesel", "electric", "hybrid", "plug-in-hybrid"
- Common mappings:
  - "gasoline" → "petrol"
  - "EV" → "electric"
  - "PHEV" → "plug-in-hybrid"
  - "HEV" → "hybrid"

## Deterministic Matching

Deterministic matching looks for exact matches on key fields.

### Matching Criteria

An offer matches deterministically if **all** of the following are true:

1. **Make**: Exact match (case-insensitive)
2. **Model**: Exact match (case-insensitive)
3. **Year**: Exact match (or within 1 year if year is missing)
4. **Trim**: Exact match (or trim is missing on both sides)

### SQL Query Pattern

```sql
SELECT cv.*
FROM canonical_vehicles cv
WHERE LOWER(cv.make) = LOWER($1)
  AND LOWER(cv.model) = LOWER($2)
  AND cv.year = $3
  AND (LOWER(cv.trim) = LOWER($4) OR cv.trim IS NULL OR $4 IS NULL)
  AND cv.is_active = TRUE
LIMIT 1;
```

### Confidence Score

Deterministic matches get `confidence_score = 1.0` (100%).

## Scored Matching

When deterministic matching fails, scored matching uses fuzzy matching with weighted fields.

### Scoring Algorithm

**Field Weights:**
- Make: 30% (high importance)
- Model: 40% (highest importance)
- Year: 15% (moderate importance)
- Trim: 10% (lower importance, often missing)
- Fuel Type: 5% (supporting factor)

### Similarity Functions

**Make/Model Similarity:**
- Levenshtein distance (normalized)
- Token-based similarity (for multi-word models)
- Abbreviation matching ("VW" matches "Volkswagen")

**Year Similarity:**
- Exact match: 1.0
- Within 1 year: 0.8
- Within 2 years: 0.5
- Otherwise: 0.0

**Trim Similarity:**
- Exact match: 1.0
- Contains match: 0.7 (e.g., "GTX" contains "GT")
- Levenshtein distance: normalized score
- Missing trim: 0.5 (neutral score)

### Calculation Example

```
Offer: { make: "volkswagen", model: "id.4", year: 2024, trim: "pro" }
Candidate: { make: "volkswagen", model: "id.4", year: 2023, trim: "pro max" }

make_score = 1.0 (exact) × 0.30 = 0.30
model_score = 1.0 (exact) × 0.40 = 0.40
year_score = 0.8 (within 1 year) × 0.15 = 0.12
trim_score = 0.7 (contains) × 0.10 = 0.07
fuel_score = 1.0 (exact) × 0.05 = 0.05

Total = 0.30 + 0.40 + 0.12 + 0.07 + 0.05 = 0.94 (94%)
```

### SQL Query Pattern

```sql
SELECT 
  cv.*,
  (
    -- Make similarity (30%)
    CASE WHEN LOWER(cv.make) = LOWER($1) THEN 0.30 ELSE 0 END +
    -- Model similarity (40%) - simplified for SQL
    CASE WHEN LOWER(cv.model) = LOWER($2) THEN 0.40 ELSE 0 END +
    -- Year similarity (15%)
    CASE WHEN cv.year = $3 THEN 0.15
         WHEN ABS(cv.year - $3) <= 1 THEN 0.12
         WHEN ABS(cv.year - $3) <= 2 THEN 0.075
         ELSE 0 END +
    -- Trim similarity (10%) - simplified
    CASE WHEN LOWER(cv.trim) = LOWER($4) THEN 0.10 ELSE 0.05 END
  ) AS confidence_score
FROM canonical_vehicles cv
WHERE cv.is_active = TRUE
  AND (
    LOWER(cv.make) = LOWER($1) OR
    LOWER(cv.model) LIKE '%' || LOWER($2) || '%'
  )
ORDER BY confidence_score DESC
LIMIT 10;
```

**Note:** Full fuzzy matching (Levenshtein) is better implemented in application code for complex scoring.

## Confidence Thresholds

### Thresholds

- **High Confidence**: `≥ 0.8` (80%) → Auto-approve match
- **Review Queue**: `0.6 ≤ score < 0.8` → Flag for manual review
- **Low Confidence**: `< 0.6` → No match, flag for investigation

### Configuration

Thresholds are configurable via environment variables:
- `MATCHING_CONFIDENCE_THRESHOLD=0.8` (auto-approve)
- `MATCHING_REVIEW_THRESHOLD=0.6` (review queue)

## Override Mappings

Override mappings take precedence over all algorithmic matching.

### Use Cases

1. **Known Naming Differences**: "VW Golf" → "Volkswagen Golf" (if normalization fails)
2. **Trim Variations**: "GTX" → "GT-X" (supplier-specific)
3. **Model Aliases**: "ID4" → "ID.4" (if normalization doesn't catch it)
4. **Special Cases**: One-off supplier quirks

### Application Order

1. Check override mappings first (before any algorithmic matching)
2. If override found → return match immediately
3. If no override → proceed to deterministic matching
4. If no deterministic match → proceed to scored matching

### SQL Query Pattern

```sql
SELECT om.canonical_vehicle_id
FROM override_mappings om
WHERE om.supplier_id = $1
  AND LOWER(om.supplier_make) = LOWER($2)
  AND LOWER(om.supplier_model) = LOWER($3)
  AND (LOWER(om.supplier_trim) = LOWER($4) OR om.supplier_trim IS NULL OR $4 IS NULL)
  AND (om.supplier_year = $5 OR om.supplier_year IS NULL OR $5 IS NULL)
  AND om.is_active = TRUE
LIMIT 1;
```

## Review Queue

Matches with confidence scores between the review threshold and confidence threshold are flagged for manual review.

### Review Queue Criteria

```sql
SELECT m.*, no.*, cv.*
FROM matches m
JOIN normalized_offers no ON m.normalized_offer_id = no.id
JOIN canonical_vehicles cv ON m.canonical_vehicle_id = cv.id
WHERE m.status = 'review'
  AND m.confidence_score >= $1  -- review_threshold
  AND m.confidence_score < $2   -- confidence_threshold
ORDER BY m.confidence_score DESC, m.matched_at ASC;
```

### Review Actions

1. **Approve**: Mark as `status = 'approved'`, match is confirmed
2. **Reject**: Mark as `status = 'rejected'`, no match found
3. **Override**: Create override mapping for future matches
4. **Update Match**: Change to different canonical vehicle

## Performance Considerations

### Indexing

- Index on `canonical_vehicles(make, model, year)` for deterministic matching
- Index on `canonical_vehicles(make)` for scored matching initial filter
- Index on `matches(status, confidence_score)` for review queue queries

### Caching

- Cache canonical vehicle data in memory (updated daily)
- Cache override mappings (updated on change)
- Cache normalization rules (static)

### Batch Processing

- Process matches in batches (100-1000 at a time)
- Use connection pooling for database queries
- Parallelize matching for multiple offers (if not database-bound)

## Future Enhancements

### Machine Learning

- Train ML model on approved matches
- Use embeddings for semantic similarity
- Continuous learning from review queue decisions

### Multi-Field Matching

- Include engine size, power, CO2 emissions in scoring
- Weight by data availability (more fields = higher confidence)

### Supplier-Specific Rules

- Custom matching rules per supplier
- Supplier-specific normalization overrides
- Supplier-specific confidence thresholds

