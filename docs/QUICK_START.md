# Quick Start Guide

## 🚀 Get the UI Running (5 minutes)

### Step 1: Set Up Web UI Environment

```bash
cd web
./setup-env.sh
# Or manually create .env.local with Supabase credentials
```

### Step 2: Start the Web UI

```bash
cd web
npm run dev
```

Open **http://localhost:3000** in your browser.

### Step 3: Run Matching (to see data)

In a new terminal, from project root:

```bash
npm run rematch-all
```

This will process all 39,407 offers and create matches. Takes 5-10 minutes.

### Step 4: View Results

Refresh the browser - you'll see:
- Statistics dashboard
- All matches in a table
- Filter by status
- Approve/Reject buttons for review items

## 📊 What the UI Shows

- **Total Matches**: How many matches were found
- **Approved**: High-confidence matches (≥80%)
- **Review Queue**: Medium-confidence matches (60-80%) needing review
- **Match Types**: Deterministic (exact), Scored (fuzzy), Override (manual)

## 🎯 Workflow

1. **Run matching** → Creates matches in database
2. **View in UI** → See all matches visually
3. **Review queue** → Approve/reject medium-confidence matches
4. **Export** → Download results as CSV/JSON

## 🔧 Troubleshooting

**UI shows "No matches found"**
- Run `npm run rematch-all` first
- Check Supabase `matches` table has data

**Can't connect to Supabase**
- Check `.env.local` has correct credentials
- Verify Supabase project is active

**Build errors**
- Make sure you're in the `web` directory
- Run `npm install` in web directory

