# Export Guide

## Overview

The export system generates output files from matched offer data. Exports include both the matched canonical vehicle data and the original supplier offer data for traceability.

## Supported Formats

### CSV Export

**Use Case:** Spreadsheet analysis, data import into other systems.

**Format:**
- Comma-separated values
- UTF-8 encoding
- Header row included
- Quoted fields (if contain commas)

**Schema:**
```csv
match_id,supplier_id,supplier_offer_id,matched_at,confidence_score,match_type,status,
canonical_vehicle_id,canonical_make,canonical_model,canonical_trim,canonical_year,
supplier_make,supplier_model,supplier_trim,supplier_year,supplier_price,supplier_currency,
raw_data
```

**Example:**
```csv
match_id,supplier_id,supplier_offer_id,matched_at,confidence_score,match_type,status,canonical_vehicle_id,canonical_make,canonical_model,canonical_trim,canonical_year,supplier_make,supplier_model,supplier_trim,supplier_year,supplier_price,supplier_currency,raw_data
1,athlon,ATH-001,2024-01-15T10:30:00Z,1.0,deterministic,approved,123,volkswagen,id.4,pro,2024,VW,ID4,Pro,2024,45000,EUR,"{""vehicle_id"":""ATH-001""}"
```

### JSON Export

**Use Case:** API consumption, programmatic processing, data pipelines.

**Format:**
- JSON Lines (NDJSON) - one JSON object per line
- UTF-8 encoding
- Pretty-printed option available

**Schema:**
```typescript
interface ExportMatch {
  match_id: number;
  matched_at: string; // ISO 8601
  confidence_score: number;
  match_type: 'deterministic' | 'scored' | 'override';
  status: 'pending' | 'approved' | 'rejected' | 'review';
  
  // Canonical vehicle data
  canonical_vehicle: {
    id: number;
    autodisk_id: string;
    make: string;
    model: string;
    trim: string | null;
    year: number;
    fuel_type: string | null;
    transmission: string | null;
    doors: number | null;
    seats: number | null;
    engine_size: number | null;
    power_hp: number | null;
    co2_emissions: number | null;
    specification: Record<string, unknown>; // Full spec JSON
  };
  
  // Supplier offer data
  supplier_offer: {
    supplier_id: string;
    supplier_offer_id: string;
    make: string | null;
    model: string | null;
    trim: string | null;
    year: number | null;
    price: number | null;
    currency: string | null;
    raw_data: Record<string, unknown>; // Original supplier data
  };
}
```

**Example:**
```json
{
  "match_id": 1,
  "matched_at": "2024-01-15T10:30:00Z",
  "confidence_score": 1.0,
  "match_type": "deterministic",
  "status": "approved",
  "canonical_vehicle": {
    "id": 123,
    "autodisk_id": "AUTO-12345",
    "make": "volkswagen",
    "model": "id.4",
    "trim": "pro",
    "year": 2024,
    "fuel_type": "electric",
    "transmission": "automatic",
    "doors": 5,
    "seats": 5,
    "engine_size": null,
    "power_hp": 201,
    "co2_emissions": 0,
    "specification": { ... }
  },
  "supplier_offer": {
    "supplier_id": "athlon",
    "supplier_offer_id": "ATH-001",
    "make": "VW",
    "model": "ID4",
    "trim": "Pro",
    "year": 2024,
    "price": 45000,
    "currency": "EUR",
    "raw_data": {
      "vehicle_id": "ATH-001",
      "make": "VW",
      "model": "ID4",
      ...
    }
  }
}
```

## Export Filters

### By Supplier

Export only matches for a specific supplier:
```bash
npm run export -- --format csv --supplier athlon --output ./exports/athlon_matches.csv
```

### By Date Range

Export matches within a date range:
```bash
npm run export -- --format json --from 2024-01-01 --to 2024-01-31 --output ./exports/january_matches.jsonl
```

### By Match Status

Export only approved matches:
```bash
npm run export -- --format csv --status approved --output ./exports/approved_matches.csv
```

### By Confidence Score

Export high-confidence matches only:
```bash
npm run export -- --format json --min-confidence 0.8 --output ./exports/high_confidence.jsonl
```

### Combined Filters

All filters can be combined:
```bash
npm run export -- \
  --format csv \
  --supplier athlon \
  --status approved \
  --min-confidence 0.8 \
  --from 2024-01-01 \
  --to 2024-01-31 \
  --output ./exports/athlon_approved_january.csv
```

## Export Implementation

### CSV Export Function

```typescript
export async function exportCsv(
  matches: MatchResult[],
  outputPath: string,
  options?: ExportOptions
): Promise<void> {
  // Generate CSV rows
  const rows = matches.map(match => [
    match.id,
    match.supplierOffer.supplierId,
    match.supplierOffer.supplierOfferId,
    match.matchedAt.toISOString(),
    match.confidenceScore,
    match.matchType,
    match.status,
    // ... more fields
  ]);
  
  // Write to file
  await writeCsvFile(outputPath, headers, rows);
}
```

### JSON Export Function

```typescript
export async function exportJson(
  matches: MatchResult[],
  outputPath: string,
  options?: ExportOptions
): Promise<void> {
  const exportData = matches.map(match => ({
    match_id: match.id,
    matched_at: match.matchedAt.toISOString(),
    canonical_vehicle: match.canonicalVehicle,
    supplier_offer: match.supplierOffer,
    // ... more fields
  }));
  
  // Write as JSON Lines
  await writeJsonLinesFile(outputPath, exportData);
}
```

## Future Export Formats

### XML Export

For systems requiring XML format:
```xml
<matches>
  <match>
    <match_id>1</match_id>
    <canonical_vehicle>
      <make>volkswagen</make>
      <model>id.4</model>
    </canonical_vehicle>
    <supplier_offer>
      <supplier_id>athlon</supplier_id>
      <supplier_offer_id>ATH-001</supplier_offer_id>
    </supplier_offer>
  </match>
</matches>
```

### Excel Export

Multi-sheet Excel file:
- Sheet 1: Matched offers
- Sheet 2: Unmatched offers (review queue)
- Sheet 3: Summary statistics

### API Endpoint

REST API for programmatic access:
```
GET /api/v1/exports/matches?supplier=athlon&status=approved&format=json
```

Returns streaming JSON response.

## Export Performance

### Large Dataset Handling

- **Streaming**: Write rows as they're processed (don't load all into memory)
- **Chunking**: Process in batches (1000 matches at a time)
- **Compression**: Gzip compress large exports
- **Pagination**: Support paginated API exports

### Optimization

- **Indexes**: Use database indexes for filtered queries
- **Parallel Processing**: Process multiple suppliers in parallel
- **Caching**: Cache canonical vehicle data (don't re-fetch for each match)

## Export Validation

### Data Integrity

- Verify all required fields present
- Validate data types (numbers, dates, strings)
- Check referential integrity (canonical vehicle exists)

### File Integrity

- Verify file written successfully
- Check file size matches expected
- Validate encoding (UTF-8)

## Export Scheduling

### Automated Exports

Schedule regular exports:
- Daily: All matches from previous day
- Weekly: Summary report
- Monthly: Full dataset export

### Implementation

Use cron jobs or job scheduler:
```bash
# Daily export at 2 AM
0 2 * * * cd /app && npm run export -- --format csv --from yesterday --output ./exports/daily_$(date +\%Y\%m\%d).csv
```

## Export Examples

### Example 1: Export All Approved Matches

```bash
npm run export -- \
  --format csv \
  --status approved \
  --output ./exports/all_approved.csv
```

### Example 2: Export Supplier-Specific JSON

```bash
npm run export -- \
  --format json \
  --supplier athlon \
  --output ./exports/athlon_matches.jsonl
```

### Example 3: Export Review Queue

```bash
npm run export -- \
  --format csv \
  --status review \
  --output ./exports/review_queue.csv
```

