# Architecture Overview

## System Layers

The system is organized into clear layers with well-defined responsibilities:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Entrypoint                       │
│                   (src/index.ts)                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    Jobs Layer                           │
│            (src/jobs/runIngestion.ts)                  │
│  Orchestrates: ingest → normalize → match → export     │
└─────┬──────────────┬──────────────┬────────────────────┘
      │              │              │
┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
│ Connectors│  │Normalize  │  │ Matching  │
│           │  │           │  │           │
│ File/API  │  │ Rules     │  │ Algorithm │
└───────────┘  └───────────┘  └───────────┘
      │              │              │
      └──────────────┴──────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    Domain Layer                         │
│              (src/domain/types.ts)                      │
│  Types: RawSupplierOffer, NormalizedOffer,             │
│         CanonicalVehicle, MatchResult                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    Database Layer                       │
│              (PostgreSQL via pg)                        │
│  Tables: raw_offers, normalized_offers,                 │
│          matches, override_mappings                     │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Ingestion Flow

1. **Connector Layer** (`src/connectors/`)
   - File connectors read CSV/XLSX files
   - API connectors fetch data from supplier endpoints
   - Both return `RawSupplierOffer[]` arrays

2. **Normalization Layer** (`src/normalization/`)
   - Takes `RawSupplierOffer` → produces `NormalizedOffer`
   - Applies standardization rules (make/model/trim)
   - Cleans and validates fields
   - Handles missing data

3. **Matching Layer** (`src/matching/`)
   - Takes `NormalizedOffer` → produces `MatchResult`
   - Queries canonical vehicle database (Autodisk)
   - Applies deterministic matching first
   - Falls back to scored matching if needed
   - Checks override mappings for known cases

4. **Export Layer** (`src/exports/`)
   - Takes `MatchResult[]` → produces files (CSV/JSON)
   - Enriches with canonical vehicle data
   - Includes original supplier data for traceability

## Connector Architecture

### File Connectors

File connectors follow a consistent pattern:

```typescript
export async function ingestAthlonFile(filePath: string): Promise<RawSupplierOffer[]>
```

**Responsibilities:**
- Parse CSV/XLSX files
- Map supplier-specific columns to `RawSupplierOffer` fields
- Handle encoding issues, malformed rows
- Return structured data

**File Structure Assumptions:**
- Each supplier may have different column names
- Each connector knows its supplier's format
- Raw data is preserved (stored in database for audit)

### API Connectors

API connectors follow a similar pattern:

```typescript
export async function ingestAthlonApi(config: ApiConfig): Promise<RawSupplierOffer[]>
```

**Responsibilities:**
- Authenticate with supplier API
- Fetch offer data (pagination if needed)
- Handle rate limiting and retries
- Map API response to `RawSupplierOffer` format

**API Patterns:**
- RESTful endpoints (most common)
- Webhook receivers (future)
- Polling vs push (configurable per supplier)

## Adding New Suppliers

### Step 1: Create Connector

Create a new file in `src/connectors/`:

```typescript
// src/connectors/newSupplierFile.ts
export async function ingestNewSupplierFile(filePath: string): Promise<RawSupplierOffer[]> {
  // Parse file, return RawSupplierOffer[]
}
```

### Step 2: Register Connector

Add to connector registry in `src/connectors/index.ts`:

```typescript
export const connectors = {
  athlon: { file: ingestAthlonFile, api: ingestAthlonApi },
  newSupplier: { file: ingestNewSupplierFile, api: null },
};
```

### Step 3: Add Normalization Rules (if needed)

If the supplier has unique naming conventions, add rules to `src/normalization/rules/`.

### Step 4: Test with Sample Data

Use the CLI to test:
```bash
npm run ingest -- --supplier newSupplier --mode file --path ./sample.csv
```

## Separation of Concerns

### Domain Layer (`src/domain/`)
- **Pure types and interfaces** - no business logic
- Defines contracts between layers
- No dependencies on other layers

### Connectors (`src/connectors/`)
- **Data acquisition only** - no transformation
- Supplier-specific parsing logic
- Returns standardized `RawSupplierOffer` format

### Normalization (`src/normalization/`)
- **Data transformation** - no matching logic
- Reusable rules across suppliers
- Supplier-specific rules when needed

### Matching (`src/matching/`)
- **Business logic** - matching algorithms
- Queries canonical database
- No knowledge of data sources

### Exports (`src/exports/`)
- **Output formatting** - no business logic
- Format-agnostic (CSV, JSON, future: XML, API)

### Jobs (`src/jobs/`)
- **Orchestration** - coordinates pipeline steps
- Error handling and retry logic
- Logging and monitoring hooks

## Extension Points

### Adding New Export Formats

1. Create `src/exports/exportXml.ts` (or similar)
2. Implement `exportMatches(matches: MatchResult[], format: 'xml'): Promise<void>`
3. Register in `src/exports/index.ts`

### Adding New Matching Algorithms

1. Create `src/matching/algorithms/newAlgorithm.ts`
2. Implement matching function
3. Integrate into `src/matching/matchOffer.ts` with fallback logic

### Adding Admin UI

The architecture supports UI addition:
- Database layer already designed for query patterns
- Export layer can be wrapped in HTTP endpoints
- Jobs can be triggered via API calls
- Match review queue designed for UI interaction

## Technology Choices

- **Node.js + TypeScript**: Type safety, large ecosystem, good for data processing
- **PostgreSQL**: Relational data, JSON support, ACID guarantees
- **CLI-first**: Simple to run, easy to schedule, no infrastructure overhead
- **File-based connectors**: Simple to test, easy to debug, common supplier format

