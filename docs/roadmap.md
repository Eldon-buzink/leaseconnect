# Product Roadmap

## MVP (Current Phase)

**Goal:** Working end-to-end pipeline with file-based ingestion, basic normalization, matching, and exports.

**Status:** ✅ Foundation complete, ready for implementation

**Features:**
- ✅ Project structure and documentation
- ✅ Domain types and interfaces
- ✅ Connector stubs (file + API)
- ✅ Normalization pipeline skeleton
- ✅ Matching skeleton
- ✅ Export modules (CSV, JSON)
- ✅ CLI entrypoint
- ⏳ Database schema implementation
- ⏳ Real normalization rules
- ⏳ Real matching algorithms
- ⏳ Error handling and logging
- ⏳ Testing

**Timeline:** 2-4 weeks

## v1.0 - Production Ready

**Goal:** Stable, production-ready system with all core features working.

**Features:**

### Database & Persistence
- [ ] Complete database schema implementation
- [ ] Migration system (e.g., node-pg-migrate)
- [ ] Connection pooling
- [ ] Database backup strategy

### Normalization
- [ ] Complete normalization rules (make, model, trim, year, fuel type)
- [ ] Supplier-specific normalization rules
- [ ] Normalization rule testing
- [ ] Normalization quality metrics

### Matching
- [ ] Deterministic matching implementation
- [ ] Scored matching algorithm (fuzzy matching)
- [ ] Confidence threshold handling
- [ ] Override mapping system
- [ ] Review queue implementation
- [ ] Matching performance optimization

### Ingestion
- [ ] File ingestion (CSV, XLSX) - complete implementation
- [ ] API ingestion - complete implementation
- [ ] Idempotency handling
- [ ] Incremental update support
- [ ] Error recovery and retry logic
- [ ] Ingestion monitoring

### Export
- [ ] CSV export - complete implementation
- [ ] JSON export - complete implementation
- [ ] Export filtering (supplier, date, status, confidence)
- [ ] Export scheduling
- [ ] Export validation

### Operations
- [ ] Comprehensive logging (structured logs)
- [ ] Error handling and reporting
- [ ] Monitoring and alerting hooks
- [ ] Performance optimization
- [ ] Documentation completion

**Timeline:** 6-8 weeks after MVP

## v1.1 - Admin UI

**Goal:** Web-based admin interface for managing suppliers, reviewing matches, and configuring the system.

**Features:**

### Supplier Management
- [ ] Supplier list and details
- [ ] Add/edit supplier configurations
- [ ] Test supplier connections
- [ ] View ingestion history

### Match Review Interface
- [ ] Review queue dashboard
- [ ] Approve/reject matches
- [ ] Create override mappings
- [ ] Bulk actions

### Override Mapping Management
- [ ] List all override mappings
- [ ] Create/edit/delete mappings
- [ ] Import/export mappings
- [ ] Mapping effectiveness metrics

### Dashboard & Reporting
- [ ] Ingestion statistics
- [ ] Match quality metrics
- [ ] Supplier data quality scores
- [ ] Export history

### Configuration
- [ ] System settings (thresholds, etc.)
- [ ] Normalization rules editor
- [ ] Matching algorithm configuration

**Technology Stack:**
- Frontend: React + TypeScript (or Next.js)
- UI Library: shadcn/ui (as per project preference)
- Backend API: Express.js or FastAPI (if Python preferred)
- Authentication: Basic auth for MVP, OAuth later

**Timeline:** 4-6 weeks after v1.0

## v1.2 - Partner API

**Goal:** REST API for external systems to query matched vehicle offers.

**Features:**

### API Endpoints
- [ ] `GET /api/v1/matches` - Query matched offers
- [ ] `GET /api/v1/matches/:id` - Get specific match
- [ ] `GET /api/v1/suppliers` - List suppliers
- [ ] `GET /api/v1/vehicles` - Query canonical vehicles
- [ ] `GET /api/v1/stats` - System statistics

### API Features
- [ ] Authentication (API keys)
- [ ] Rate limiting
- [ ] Pagination
- [ ] Filtering and sorting
- [ ] Field selection
- [ ] API documentation (OpenAPI/Swagger)

### API Client Libraries
- [ ] TypeScript/JavaScript SDK
- [ ] Python SDK
- [ ] Example code and tutorials

**Timeline:** 3-4 weeks after v1.1

## v2.0 - Advanced Features

**Goal:** Enhanced matching, analytics, and multi-tenant support.

### Advanced Matching
- [ ] Machine learning-based matching
- [ ] Semantic similarity (embeddings)
- [ ] Multi-field matching (engine, power, CO2)
- [ ] Continuous learning from review decisions
- [ ] Supplier-specific matching algorithms

### Price History
- [ ] Track price changes over time
- [ ] Price trend analysis
- [ ] Historical price queries
- [ ] Price alerts

### Analytics & Insights
- [ ] Market analysis dashboard
- [ ] Supplier comparison reports
- [ ] Vehicle popularity metrics
- [ ] Price competitiveness analysis
- [ ] Data quality trends

### Multi-Tenant Support
- [ ] Tenant isolation (database-level)
- [ ] Per-tenant configuration
- [ ] Tenant-specific normalization rules
- [ ] Tenant-specific matching thresholds
- [ ] Tenant management UI

**Timeline:** 8-12 weeks after v1.2

## v2.1 - Enterprise Features

**Goal:** Enterprise-grade features for large-scale deployments.

### Scalability
- [ ] Horizontal scaling (multiple workers)
- [ ] Message queue integration (Kafka, RabbitMQ)
- [ ] Caching layer (Redis)
- [ ] Database sharding (if needed)

### Reliability
- [ ] High availability setup
- [ ] Disaster recovery
- [ ] Automated failover
- [ ] Health checks and monitoring

### Security
- [ ] Advanced authentication (OAuth 2.0, SAML)
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] Data encryption at rest
- [ ] Compliance features (GDPR, etc.)

### Integration
- [ ] Webhook support (suppliers push data)
- [ ] ETL tool integrations (Airbyte, Fivetran)
- [ ] BI tool integrations (Tableau, Power BI)
- [ ] Data warehouse exports (Snowflake, BigQuery)

**Timeline:** 12-16 weeks after v2.0

## Future Considerations

### AI/ML Enhancements
- [ ] Automated normalization rule generation
- [ ] Anomaly detection (unusual offers, data quality issues)
- [ ] Predictive matching (suggest matches before review)
- [ ] Natural language processing (parse free-text descriptions)

### Data Sources
- [ ] Additional canonical sources (beyond Autodisk)
- [ ] Real-time data feeds
- [ ] Market data integration
- [ ] Competitor pricing data

### Mobile App
- [ ] Mobile app for match review
- [ ] Push notifications for review queue
- [ ] Offline support

### Internationalization
- [ ] Multi-language support
- [ ] Regional vehicle specifications
- [ ] Currency handling
- [ ] Localization of naming conventions

## Prioritization Guidelines

**High Priority:**
- Features that unblock users
- Features that improve data quality
- Features that reduce manual work

**Medium Priority:**
- Features that improve user experience
- Features that add convenience
- Features that enable new use cases

**Low Priority:**
- Nice-to-have features
- Experimental features
- Features with unclear ROI

## Versioning Strategy

- **Major versions (v1, v2)**: Breaking changes, major feature additions
- **Minor versions (v1.1, v1.2)**: New features, backward compatible
- **Patch versions (v1.0.1)**: Bug fixes, minor improvements

## Release Cadence

- **MVP**: As soon as core features work
- **v1.0**: When production-ready (stable, tested, documented)
- **v1.x**: Every 4-6 weeks (new features)
- **v2.0**: When major architectural changes needed
- **Patches**: As needed (critical bugs)

