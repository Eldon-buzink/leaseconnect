# Documentation Index

All documentation for the Leaseconnect project.

## 🚀 Getting Started

- **[QUICK_START.md](QUICK_START.md)** - Get started in 5 minutes
- **[VERIFICATION.md](VERIFICATION.md)** - Step-by-step verification guide
- **[WEB_UI_SETUP.md](WEB_UI_SETUP.md)** - Web dashboard setup instructions
- **[SETUP_SUMMARY.md](SETUP_SUMMARY.md)** - Summary of what was set up
- **[NEXT_STEPS.md](NEXT_STEPS.md)** - What to do next
- **[AUTOMATED_SETUP.md](AUTOMATED_SETUP.md)** - Automated setup status

## 📖 Technical Documentation

- **[product.md](product.md)** - Product overview, requirements, scope, MVP milestones
- **[architecture.md](architecture.md)** - System architecture, data flow, connectors
- **[data-model.md](data-model.md)** - Database schema, tables, relationships, indexes
- **[matching.md](matching.md)** - Matching strategy, normalization rules, algorithms
- **[ingestion.md](ingestion.md)** - File/API ingestion patterns, idempotency
- **[export.md](export.md)** - Export formats, filtering options, examples
- **[design-guidelines.md](design-guidelines.md)** - Code style, error handling, testing
- **[debug.md](debug.md)** - Debugging guide, common failures, troubleshooting
- **[roadmap.md](roadmap.md)** - Product roadmap (MVP → v1 → v2)
- **[security.md](security.md)** - Security guidelines, secrets management

## 📋 Quick Reference

### Web UI
- **Localhost:** http://localhost:3000
- **Setup:** See [WEB_UI_SETUP.md](WEB_UI_SETUP.md)

### Common Commands
```bash
npm run verify          # Verify setup
npm run load-autodisk   # Load canonical vehicles
npm run rematch-all     # Match all offers
npm run export          # Export results
```

### Key Files
- Database schema: `scripts/create-tables.sql`
- Web UI: `web/` directory
- Source code: `src/` directory
