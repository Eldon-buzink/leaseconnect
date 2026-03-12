# Leaseconnect

Car specification matching system for leasing companies. Matches supplier vehicle offers to canonical Autodisk vehicle specifications.

## 🚀 Quick Start

### Web UI (Recommended)

1. **From project root**, start the web app (this is the default `dev` command):
   ```bash
   npm run dev
   ```
   The terminal will show the URL (e.g. **http://localhost:3000**). Open that exact URL in your browser.

2. **First-time setup** (env and deps): if needed, run once:
   ```bash
   cd web && ./setup-env.sh && npm install
   ```
   Then from root again: `npm run dev`.

3. **If you see 404 on http://localhost:3000:**  
   Something else is using port 3000. Stop any other dev servers (e.g. backend, another terminal with `npm run dev`), then run `npm run dev` again. If it still says "Port 3000 is already in use", free it:
   ```bash
   npx kill-port 3000
   ```
   Then run `npm run dev` again and open http://localhost:3000.

4. **Run matching** (to see data):
   ```bash
   # From project root
   npm run rematch-all
   ```

See [docs/QUICK_START.md](docs/QUICK_START.md) for detailed instructions.

### Deploying to Vercel

The Next.js app lives in the `web/` folder. In Vercel:

1. **Project Settings → General → Root Directory**  
   Set to **`web`** (click "Edit", enter `web`, save).
2. **Redeploy**  
   Trigger a new deployment so the build runs from `web/` and uses `next build`.

### CLI Usage

```bash
# Verify setup
npm run verify

# Load canonical vehicles
npm run load-autodisk

# Process supplier file
npm run ingest -- --supplier athlon --mode file --path ./src/examples/Athlon_bulk.xlsx

# Re-match all offers
npm run rematch-all

# Export results
npm run export -- --format csv --output ./exports/matches.csv
```

## 📚 Documentation

All documentation is in the [`docs/`](docs/) directory:

- **[QUICK_START.md](docs/QUICK_START.md)** - Get started in 5 minutes
- **[VERIFICATION.md](docs/VERIFICATION.md)** - Step-by-step verification guide
- **[WEB_UI_SETUP.md](docs/WEB_UI_SETUP.md)** - Web dashboard setup
- **[SETUP_SUMMARY.md](docs/SETUP_SUMMARY.md)** - What was set up
- **[NEXT_STEPS.md](docs/NEXT_STEPS.md)** - What to do next
- **[AUTOMATED_SETUP.md](docs/AUTOMATED_SETUP.md)** - Automated setup status

### Technical Documentation

- **[product.md](docs/product.md)** - Product overview and requirements
- **[architecture.md](docs/architecture.md)** - System architecture
- **[data-model.md](docs/data-model.md)** - Database schema
- **[matching.md](docs/matching.md)** - Matching strategy
- **[ingestion.md](docs/ingestion.md)** - Ingestion guide
- **[export.md](docs/export.md)** - Export guide
- **[design-guidelines.md](docs/design-guidelines.md)** - Code style and best practices
- **[debug.md](docs/debug.md)** - Debugging guide
- **[roadmap.md](docs/roadmap.md)** - Product roadmap
- **[security.md](docs/security.md)** - Security guidelines

## 🏗️ Project Structure

```
Leaseconnect/
├── docs/                    # All documentation
├── src/                     # Source code
│   ├── domain/             # Domain types
│   ├── connectors/         # Supplier connectors
│   ├── normalization/      # Data normalization
│   ├── matching/           # Matching algorithms
│   ├── exports/            # Export modules
│   ├── jobs/               # Job orchestrators
│   └── utils/              # Utilities
├── web/                     # Next.js web dashboard
├── scripts/                 # Utility scripts
└── package.json
```

## 🎯 Current Status

- ✅ Database tables created
- ✅ 24,672 canonical vehicles loaded
- ✅ 39,407 Athlon offers processed
- ✅ Matching logic implemented
- ✅ Web UI created
- ⏳ Run matching to see results

## 🔗 Links

- **Web Dashboard:** Run `npm run dev` from project root, then open the URL shown (e.g. http://localhost:3000). Do not open a different port or you will get 404s.
- **Backend/API** (optional): `npm run dev:api` from project root.
- **GitHub:** https://github.com/Eldon-buzink/leaseconnect

## 📝 License

MIT

