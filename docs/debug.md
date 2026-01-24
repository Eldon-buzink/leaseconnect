# Debug Playbook

## Common Failures

### Ingestion Failures

#### File Not Found

**Symptoms:**
```
Error: ENOENT: no such file or directory, open './data/athlon.csv'
```

**Debug Steps:**
1. Verify file path is correct (absolute vs relative)
2. Check file permissions (read access)
3. Verify file exists: `ls -la ./data/athlon.csv`
4. Check current working directory: `pwd`

**Solution:**
```bash
# Use absolute path
npm run ingest -- --supplier athlon --mode file --path /full/path/to/athlon.csv

# Or verify relative path from project root
cd /Users/eldonbuzink/Leaseconnect
npm run ingest -- --supplier athlon --mode file --path ./data/athlon.csv
```

#### Invalid File Format

**Symptoms:**
```
Error: Unable to parse CSV file: Invalid CSV format
```

**Debug Steps:**
1. Check file encoding (should be UTF-8)
2. Verify CSV structure (headers, delimiters)
3. Check for special characters or BOM (Byte Order Mark)
4. Inspect first few rows: `head -5 ./data/athlon.csv`

**Solution:**
```bash
# Check file encoding
file -I ./data/athlon.csv

# Convert to UTF-8 if needed
iconv -f ISO-8859-1 -t UTF-8 ./data/athlon.csv > ./data/athlon_utf8.csv

# Inspect file structure
head -10 ./data/athlon.csv | cat -A  # Shows hidden characters
```

#### Database Connection Error

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Debug Steps:**
1. Verify PostgreSQL is running: `pg_isready`
2. Check connection string in `.env` file
3. Verify database exists: `psql -l`
4. Check credentials (username, password)

**Solution:**
```bash
# Start PostgreSQL (macOS)
brew services start postgresql

# Verify connection
psql -h localhost -U postgres -d leaseconnect

# Check .env file
cat .env | grep DATABASE_URL
```

### Normalization Failures

#### Missing Required Fields

**Symptoms:**
```
WARN: Normalization partial for offer ATH-001: missing make field
```

**Debug Steps:**
1. Inspect raw offer data in database:
```sql
SELECT raw_data FROM raw_offers WHERE supplier_offer_id = 'ATH-001';
```

2. Check connector mapping (are columns mapped correctly?)
3. Verify source file has expected columns

**Solution:**
- Update connector mapping if column names changed
- Add default values for optional fields
- Flag offers with missing critical fields for manual review

#### Normalization Rule Not Applied

**Symptoms:**
```
Normalized offer has make="VW" instead of "volkswagen"
```

**Debug Steps:**
1. Check normalization function logs
2. Verify normalization rules are applied:
```typescript
// Add debug logging
logger.debug('Normalizing make', { input: rawOffer.make, output: normalizedMake });
```

3. Test normalization function directly:
```typescript
import { normalizeMake } from './normalization/normalizeOffer';
console.log(normalizeMake('VW')); // Should output "volkswagen"
```

**Solution:**
- Update normalization rules if needed
- Add test cases for edge cases
- Verify rule order (some rules may override others)

### Matching Failures

#### No Match Found

**Symptoms:**
```
INFO: No match found for offer ATH-001 (confidence: 0.45)
```

**Debug Steps:**
1. Check normalized offer data:
```sql
SELECT * FROM normalized_offers WHERE supplier_offer_id = 'ATH-001';
```

2. Check canonical vehicle database:
```sql
SELECT * FROM canonical_vehicles 
WHERE make = 'volkswagen' AND model LIKE '%id%';
```

3. Verify matching algorithm is working:
```typescript
// Test matching function
const result = await matchOffer(normalizedOffer);
console.log('Match result:', result);
```

**Solution:**
- Verify canonical vehicle exists in database
- Check if normalization produced correct values
- Consider adding override mapping if it's a known edge case
- Review matching algorithm thresholds

#### Low Confidence Score

**Symptoms:**
```
INFO: Match found with low confidence (0.65) for offer ATH-001
```

**Debug Steps:**
1. Inspect match details:
```sql
SELECT m.*, cv.make, cv.model, no.make as offer_make, no.model as offer_model
FROM matches m
JOIN canonical_vehicles cv ON m.canonical_vehicle_id = cv.id
JOIN normalized_offers no ON m.normalized_offer_id = no.id
WHERE no.supplier_offer_id = 'ATH-001';
```

2. Compare normalized offer vs canonical vehicle:
   - Make: match?
   - Model: match?
   - Year: match?
   - Trim: match?

**Solution:**
- Review normalization rules (may need improvement)
- Consider manual override mapping
- Adjust confidence thresholds if appropriate
- Flag for manual review

## Inspecting Raw Rows

### Query Raw Offers

```sql
-- Get all raw offers for a supplier
SELECT 
  id,
  supplier_id,
  supplier_offer_id,
  ingested_at,
  raw_data
FROM raw_offers
WHERE supplier_id = 'athlon'
ORDER BY ingested_at DESC
LIMIT 10;
```

### Inspect Specific Offer

```sql
-- Get raw data for specific offer
SELECT raw_data::text
FROM raw_offers
WHERE supplier_id = 'athlon' AND supplier_offer_id = 'ATH-001';
```

### Compare Raw vs Normalized

```sql
-- Compare raw and normalized data
SELECT 
  ro.supplier_offer_id,
  ro.raw_data->>'Make' as raw_make,
  ro.raw_data->>'Model' as raw_model,
  no.make as normalized_make,
  no.model as normalized_model
FROM raw_offers ro
LEFT JOIN normalized_offers no ON no.raw_offer_id = ro.id
WHERE ro.supplier_id = 'athlon'
LIMIT 10;
```

## Troubleshooting Parsing Issues

### CSV Parsing Problems

**Issue: Commas in quoted fields**

**Debug:**
```bash
# Check if quotes are properly escaped
cat data/athlon.csv | grep -n ',' | head -5
```

**Solution:**
- Ensure CSV parser handles quoted fields correctly
- Verify quotes are escaped: `"value, with comma"`

**Issue: Encoding problems**

**Debug:**
```bash
# Check file encoding
file -I data/athlon.csv

# Check for BOM
head -c 3 data/athlon.csv | od -An -tx1
# Should not start with EF BB BF (UTF-8 BOM)
```

**Solution:**
```typescript
// Remove BOM if present
const content = await readFile(filePath, 'utf-8');
const contentWithoutBOM = content.replace(/^\uFEFF/, '');
```

### XLSX Parsing Problems

**Issue: Multiple sheets**

**Debug:**
```typescript
// List all sheets
const workbook = XLSX.readFile(filePath);
console.log('Sheets:', workbook.SheetNames);
```

**Solution:**
- Specify sheet name or index in connector
- Process all sheets if needed

**Issue: Merged cells**

**Debug:**
- Inspect Excel file manually
- Check if merged cells cause data loss

**Solution:**
- Handle merged cells in parser
- Or pre-process Excel file to unmerge cells

## Database Debugging

### Check Table Contents

```sql
-- Count records per table
SELECT 
  'raw_offers' as table_name, COUNT(*) as count FROM raw_offers
UNION ALL
SELECT 'normalized_offers', COUNT(*) FROM normalized_offers
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'canonical_vehicles', COUNT(*) FROM canonical_vehicles;
```

### Check Data Quality

```sql
-- Check for missing normalized fields
SELECT 
  COUNT(*) as total,
  COUNT(make) as has_make,
  COUNT(model) as has_model,
  COUNT(year) as has_year,
  COUNT(trim) as has_trim
FROM normalized_offers;
```

### Check Match Quality

```sql
-- Distribution of confidence scores
SELECT 
  CASE 
    WHEN confidence_score >= 0.8 THEN 'high'
    WHEN confidence_score >= 0.6 THEN 'medium'
    ELSE 'low'
  END as confidence_level,
  COUNT(*) as count
FROM matches
GROUP BY confidence_level;
```

## Logging Debug Information

### Enable Debug Logging

Set log level in `.env`:
```bash
LOG_LEVEL=debug
```

### Add Debug Logs

```typescript
import { logger } from '../utils/logger';

// Log normalization steps
logger.debug('Normalizing offer', {
  supplierId: offer.supplierId,
  rawMake: offer.make,
  normalizedMake: normalized.make,
});

// Log matching steps
logger.debug('Matching offer', {
  normalizedOffer: normalized,
  candidates: candidates.length,
  bestMatch: bestMatch?.confidenceScore,
});
```

### View Logs

```bash
# Run ingestion with debug output
LOG_LEVEL=debug npm run ingest -- --supplier athlon --mode file --path ./data/athlon.csv

# Or redirect to file
npm run ingest -- --supplier athlon --mode file --path ./data/athlon.csv 2>&1 | tee ingestion.log
```

## Common Issues and Solutions

### Issue: Duplicate Offers

**Symptoms:** Same offer ingested multiple times

**Solution:**
- Check idempotency logic (unique constraint)
- Verify `ingested_at` timestamp handling
- Use upsert pattern if needed

### Issue: Performance Slow

**Symptoms:** Ingestion takes too long

**Solution:**
- Check database indexes exist
- Process in batches (not one-by-one)
- Use connection pooling
- Check for N+1 query problems

### Issue: Memory Issues

**Symptoms:** Process runs out of memory

**Solution:**
- Stream large files (don't load entire file)
- Process in batches
- Increase Node.js memory: `node --max-old-space-size=4096`

## Getting Help

### Collect Debug Information

Before asking for help, collect:

1. **Error message**: Full error with stack trace
2. **Input data**: Sample of input file/data
3. **Configuration**: `.env` file (redact secrets)
4. **Logs**: Relevant log output
5. **Database state**: Relevant queries and results

### Useful Commands

```bash
# Check Node.js version
node --version

# Check PostgreSQL version
psql --version

# Check installed packages
npm list

# Run with verbose output
DEBUG=* npm run ingest -- --supplier athlon --mode file --path ./data/athlon.csv
```

