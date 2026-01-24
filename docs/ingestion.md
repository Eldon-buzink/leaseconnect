# Ingestion Guide

## Overview

Ingestion is the process of acquiring data from suppliers and storing it in the system. Suppliers can provide data via **file uploads** (CSV/XLSX) or **API pulls**. The system handles both synchronously and supports future asynchronous patterns.

## Ingestion Modes

### File-Based Ingestion

**Use Case:** Suppliers send CSV/XLSX files via email, FTP, or file upload.

**Process:**
1. Receive file (manual upload or automated fetch)
2. Parse file format (CSV or XLSX)
3. Map supplier columns to `RawSupplierOffer` format
4. Store raw data in `raw_offers` table
5. Return list of ingested offers

**Example:**
```bash
npm run ingest -- --supplier athlon --mode file --path ./data/athlon_offers_2024-01-15.csv
```

### API-Based Ingestion

**Use Case:** Suppliers provide REST API endpoints for real-time or scheduled pulls.

**Process:**
1. Authenticate with supplier API (API key, OAuth, etc.)
2. Fetch offer data (handle pagination if needed)
3. Map API response to `RawSupplierOffer` format
4. Store raw data in `raw_offers` table
5. Return list of ingested offers

**Example:**
```bash
npm run ingest -- --supplier athlon --mode api --config ./config/athlon-api.json
```

## File Ingestion Rules

### Supported Formats

- **CSV**: Comma-separated values, UTF-8 encoding
- **XLSX**: Excel 2007+ format
- **XLS**: Excel 97-2003 format (converted to XLSX internally)

### File Structure Assumptions

Each supplier may have different column names. Connectors map supplier-specific columns to standard `RawSupplierOffer` fields.

**Example Athlon CSV:**
```csv
Vehicle ID,Make,Model,Trim,Year,Fuel,Price,Currency
ATH-001,VW,ID4,Pro,2024,Electric,45000,EUR
ATH-002,BMW,3 Series,320d,2024,Diesel,42000,EUR
```

**Mapping:**
- "Vehicle ID" → `supplierOfferId`
- "Make" → `make`
- "Model" → `model`
- "Trim" → `trim`
- "Year" → `year`
- "Fuel" → `fuelType`
- "Price" → `price`
- "Currency" → `currency`

### Parsing Rules

1. **Encoding Detection**: Try UTF-8 first, fall back to ISO-8859-1 if needed
2. **Header Row**: First row is assumed to be headers (skip if not found)
3. **Empty Rows**: Skip empty rows
4. **Malformed Rows**: Log warning, continue processing (don't fail entire ingestion)
5. **Data Types**: Parse strings to appropriate types (numbers, dates, booleans)

### Error Handling

- **File Not Found**: Return error, don't proceed
- **Invalid Format**: Return error with details
- **Partial Parsing**: Continue processing, log errors for failed rows
- **Database Errors**: Rollback transaction, return error

## API Ingestion Patterns

### Authentication

**API Key:**
```typescript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

**OAuth 2.0:**
```typescript
// Get access token first
const token = await getOAuthToken(config);
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Pagination

**Page-Based:**
```typescript
let page = 1;
let hasMore = true;
while (hasMore) {
  const response = await fetch(`${baseUrl}/offers?page=${page}&limit=100`);
  const data = await response.json();
  offers.push(...data.offers);
  hasMore = data.hasMore;
  page++;
}
```

**Cursor-Based:**
```typescript
let cursor = null;
do {
  const url = cursor ? `${baseUrl}/offers?cursor=${cursor}` : `${baseUrl}/offers`;
  const response = await fetch(url);
  const data = await response.json();
  offers.push(...data.offers);
  cursor = data.nextCursor;
} while (cursor);
```

### Rate Limiting

**Exponential Backoff:**
```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### Error Handling

- **401 Unauthorized**: Check credentials, return error
- **403 Forbidden**: Check permissions, return error
- **429 Too Many Requests**: Retry with backoff
- **500 Server Error**: Retry with backoff, log error
- **Network Errors**: Retry with backoff, log error

## Idempotency

### Problem

Running ingestion twice should not create duplicate records.

### Solution

Use composite unique constraint on `(supplier_id, supplier_offer_id, ingested_at)`.

**If same offer ingested twice:**
- Same `supplier_id` and `supplier_offer_id`
- Different `ingested_at` timestamps → Both records stored (historical tracking)
- Same `ingested_at` timestamp → Database constraint prevents duplicate

### Deduplication Strategy

**Option 1: Check Before Insert**
```sql
SELECT id FROM raw_offers
WHERE supplier_id = $1
  AND supplier_offer_id = $2
  AND ingested_at = $3;
```

**Option 2: Upsert Pattern**
```sql
INSERT INTO raw_offers (...)
VALUES (...)
ON CONFLICT (supplier_id, supplier_offer_id, ingested_at) DO NOTHING;
```

**Option 3: Hash-Based Deduplication**
- Generate hash of offer data
- Check if hash exists before inserting
- Useful for detecting identical offers across different timestamps

## Incremental Updates

### Problem

Only process new or changed offers, not entire dataset every time.

### Solution

**Strategy 1: Timestamp-Based**
- Supplier provides `updated_at` timestamp
- Only fetch offers where `updated_at > last_ingestion_time`
- Store `last_ingestion_time` per supplier

**Strategy 2: Change Detection**
- Compare new offer data with existing normalized offer
- If fields changed → reprocess normalization and matching
- If unchanged → skip

**Strategy 3: Supplier-Specific**
- Some suppliers provide "delta" endpoints (only changed offers)
- Use delta endpoint if available
- Fall back to full fetch if not

### Implementation

```typescript
async function ingestIncremental(supplierId: string): Promise<RawSupplierOffer[]> {
  const lastIngestion = await getLastIngestionTime(supplierId);
  const newOffers = await fetchOffersSince(supplierId, lastIngestion);
  
  // Process only new offers
  for (const offer of newOffers) {
    await storeRawOffer(offer);
  }
  
  await updateLastIngestionTime(supplierId, new Date());
  return newOffers;
}
```

## Retention of Raw Rows

### Policy

**Keep all raw data indefinitely** (or as per compliance requirements).

### Rationale

1. **Audit Trail**: Compliance and debugging
2. **Reprocessing**: If normalization rules change, can reprocess raw data
3. **Historical Analysis**: Track changes over time
4. **Debugging**: Investigate data quality issues

### Storage Considerations

- **Database**: Store in PostgreSQL JSONB column (efficient, queryable)
- **Archival**: Move old data to cold storage if needed (future)
- **Compression**: JSONB is compressed automatically by PostgreSQL

### Cleanup (Future)

If retention policy requires cleanup:
```sql
-- Delete raw offers older than 2 years
DELETE FROM raw_offers
WHERE ingested_at < NOW() - INTERVAL '2 years';
```

## Ingestion Workflow

### Complete Flow

```
1. Receive Data (File/API)
   │
2. Parse & Validate
   │
3. Map to RawSupplierOffer[]
   │
4. Store in raw_offers (idempotent)
   │
5. Return RawSupplierOffer[]
   │
6. Continue to Normalization Pipeline
```

### Error Recovery

- **Partial Failure**: Store successfully parsed offers, log failures
- **Complete Failure**: Rollback transaction, return error
- **Retry Logic**: Retry transient failures (network, rate limits)
- **Dead Letter Queue**: Store unprocessable offers for manual review (future)

## Monitoring

### Metrics to Track

- **Ingestion Rate**: Offers ingested per hour/day
- **Success Rate**: Percentage of successful ingestions
- **Error Rate**: Percentage of failed rows
- **Latency**: Time to ingest batch
- **Data Quality**: Percentage of offers with missing fields

### Logging

Log at appropriate levels:
- **INFO**: Ingestion started, completed, summary stats
- **WARN**: Partial failures, malformed rows, retries
- **ERROR**: Complete failures, database errors, API errors

### Alerts

- **Ingestion Failure**: Alert if ingestion fails completely
- **High Error Rate**: Alert if >5% of rows fail
- **Missing Data**: Alert if critical fields missing in >10% of offers

## Future Enhancements

### Webhook Receivers

- Suppliers push data via webhooks
- Real-time ingestion
- Validate webhook signatures
- Handle duplicate webhook deliveries

### Streaming Ingestion

- Process data as it arrives (not batch)
- Use message queue (Kafka, RabbitMQ)
- Handle backpressure

### Data Validation

- Schema validation (JSON Schema, CSV schema)
- Business rule validation (price ranges, year ranges)
- Data quality scoring

