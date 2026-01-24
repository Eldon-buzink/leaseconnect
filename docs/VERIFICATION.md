# How to Verify Everything is Working

This guide helps you verify that the Leaseconnect system is set up correctly and working.

## Step 1: Set Up Supabase Credentials

1. Go to your Supabase project: https://supabase.com/dashboard/project/qkcjlbycgytlinsblrja
2. Go to **Settings** → **API**
3. Copy your **anon/public key** and **service_role key**
4. Create a `.env` file in the project root (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
5. Edit `.env` and add your Supabase keys:
   ```
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Step 2: Run Database Migrations

1. Run the migration script:
   ```bash
   npm run migrate
   ```
2. Copy the SQL that appears in the terminal
3. Go to Supabase Dashboard → **SQL Editor**
4. Paste the SQL and click **Run**
5. You should see "Success" messages

## Step 3: Verify Setup

Run the verification script:
```bash
npm run verify
```

This will:
- ✅ Test Supabase connection
- ✅ Check if example files exist
- ✅ Test loading Autodisk data
- ✅ Test parsing Athlon file
- ✅ Test normalization
- ✅ Test matching

You should see green checkmarks (✅) for each step.

## Step 4: Load Canonical Vehicle Data

Load the Autodisk canonical vehicles into your database:
```bash
npm run load-autodisk
```

This will:
- Parse the Autodisk CSV file
- Load vehicles into the `canonical_vehicles` table
- Show you how many vehicles were loaded

**Expected output:**
```
✅ Successfully loaded 24676 canonical vehicles
```

## Step 5: Process Athlon File

Process the Athlon bulk file:
```bash
npm run ingest -- --supplier athlon --mode file --path ./src/examples/Athlon_bulk.xlsx
```

This will:
- Parse the Athlon XLSX file
- Normalize the data
- Match offers to canonical vehicles
- Store everything in the database

## Step 6: Check Results in Supabase

1. Go to Supabase Dashboard → **Table Editor**
2. Check these tables:
   - `raw_offers` - Should have Athlon offers
   - `normalized_offers` - Should have normalized data
   - `matches` - Should have match results (if matching is implemented)
   - `canonical_vehicles` - Should have Autodisk vehicles

## Step 7: Export Results

Export matched results to CSV:
```bash
npm run export -- --format csv --output ./exports/matches.csv
```

Check the `./exports/` folder for your results.

## Troubleshooting

### "Missing SUPABASE_ANON_KEY"
- Make sure you created a `.env` file
- Make sure you added your Supabase keys to `.env`

### "Table doesn't exist"
- Run migrations (Step 2)
- Make sure you ran the SQL in Supabase SQL Editor

### "File not found"
- Make sure the example files are in `src/examples/`
- Check file paths are correct

### "Connection failed"
- Check your Supabase project ID is correct
- Check your API keys are correct
- Make sure your Supabase project is active

## Quick Test Commands

```bash
# Test everything
npm run verify

# Load canonical vehicles
npm run load-autodisk

# Process Athlon file
npm run ingest -- --supplier athlon --mode file --path ./src/examples/Athlon_bulk.xlsx

# Export results
npm run export -- --format csv --output ./exports/matches.csv
```

## What to Look For

✅ **Good signs:**
- Verification script shows all green checkmarks
- No error messages
- Data appears in Supabase tables
- Export files are created

❌ **Problems:**
- Red error messages
- "Table doesn't exist" errors
- Empty results when you expect data
- Connection errors

If you see problems, check the error messages - they usually tell you what's wrong!

