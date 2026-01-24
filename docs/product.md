# Product Overview

## Problem Statement

Leasing companies receive vehicle offers from multiple suppliers, each with different naming conventions, data formats, and specification details. Matching these offers to a canonical vehicle specification database (Autodisk) is a manual, error-prone process that doesn't scale.

**Example Challenges:**
- "VW ID4" vs "Volkswagen ID.4" vs "Volkswagen ID4 Pro"
- Trim variations: "GTX" vs "GT-X" vs "GT X"
- Partial or dirty data fields
- Different data sources: CSV/XLSX files vs API endpoints

## Users

1. **Data Operations Team**: Manages supplier integrations, monitors ingestion pipelines, reviews matching results
2. **Business Analysts**: Need accurate matched data for pricing analysis and market insights
3. **Future: Partner API Consumers**: External systems that query matched vehicle offers

## Requirements

### Functional Requirements

1. **Multi-Source Ingestion**
   - Support file uploads (CSV/XLSX) from suppliers
   - Support API-based data pulls from suppliers
   - Handle both synchronous and asynchronous ingestion patterns

2. **Normalization**
   - Standardize vehicle names, makes, models, trims
   - Clean and validate supplier data fields
   - Handle missing or partial data gracefully

3. **Matching**
   - Match supplier offers to canonical Autodisk vehicle specifications
   - Provide confidence scores for matches
   - Flag uncertain matches for manual review
   - Support override mappings for known edge cases

4. **Export**
   - Export matched results in CSV and JSON formats
   - Include both matched canonical data and original supplier data
   - Support filtered exports (by supplier, date range, match confidence)

5. **Automation**
   - Scheduled ingestion jobs (daily/hourly)
   - Idempotent processing (handle duplicate runs safely)
   - Incremental updates (only process new/changed offers)

### Non-Functional Requirements

1. **Scalability**: Handle hundreds of suppliers, thousands of offers per day
2. **Maintainability**: Clear separation of concerns, well-documented code
3. **Reliability**: Robust error handling, logging, audit trails
4. **Extensibility**: Easy to add new suppliers, new matching rules, new export formats

## Scope

### In Scope (MVP)

- File-based ingestion (CSV/XLSX)
- API-based ingestion (stubbed, ready for implementation)
- Basic normalization (make/model/trim standardization)
- Deterministic matching (exact matches)
- Scored matching (fuzzy matching with confidence thresholds)
- CSV and JSON exports
- CLI-based execution
- PostgreSQL database for persistence
- Manual override mappings

### Out of Scope (MVP)

- Web UI (designed for future addition)
- Real-time API endpoints for external consumers
- Price history tracking
- Multi-tenant isolation (single tenant for MVP)
- Advanced ML-based matching (scored matching only)
- Automated supplier onboarding workflows

## MVP Milestones

### Milestone 1: Foundation (Current)
- ✅ Project structure and documentation
- ✅ Domain types and interfaces
- ✅ Connector stubs (file + API)
- ✅ Basic normalization pipeline
- ✅ Matching skeleton
- ✅ Export modules
- ✅ CLI entrypoint

### Milestone 2: Database & Persistence
- Database schema implementation
- Raw offer storage
- Normalized offer storage
- Match result storage
- Override mapping storage

### Milestone 3: Real Matching Logic
- Implement normalization rules (make/model/trim)
- Implement deterministic matching
- Implement scored matching algorithm
- Confidence threshold handling
- Review queue creation

### Milestone 4: Production Readiness
- Error handling and retry logic
- Comprehensive logging
- Monitoring hooks
- Performance optimization
- Documentation completion

### Milestone 5: Admin UI (Future)
- Supplier management interface
- Match review interface
- Override mapping management
- Dashboard and reporting

