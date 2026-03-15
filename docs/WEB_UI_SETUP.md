# Web UI Setup Guide

## Quick Start

The web dashboard lets you visualize matching results without looking at raw database tables.

### 1. Set Up Environment Variables

The web app needs Supabase credentials. Create `.env.local` in the repository root:

```bash
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://qkcjlbycgytlinsblrja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrY2psYnljZ3l0bGluc2JscmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTgzOTEsImV4cCI6MjA4NDU3NDM5MX0.C4PRMr9e6-57acey6fx-DyuBVdNeEzq2RziNGKlpWbw
EOF
```

### 2. Start the Development Server

```bash
npm run dev
```

### 3. Open Your Browser

Go to: **http://localhost:3000**

## What You'll See

### Dashboard Overview

- **Statistics Cards**: Total matches, approved, review queue, match types
- **Filter Tabs**: Filter by status (All, Approved, Review, Pending)
- **Matches Table**: Shows all matches with:
  - Supplier offer details (make, model, trim, year)
  - Matched canonical vehicle
  - Match type (deterministic, scored, override)
  - Confidence score (color-coded)
  - Status badge
  - Actions (approve/reject for review items)

### Features

1. **View All Matches**: See all matches found by the system
2. **Filter by Status**: Focus on review queue or approved matches
3. **Review Actions**: Approve or reject matches that need review
4. **Confidence Scores**: See how confident each match is (color-coded)
5. **Match Types**: See if matches were exact (deterministic), fuzzy (scored), or manual (override)

## Before You See Data

You need to run matching first! The dashboard will show "No matches found" until you run:

```bash
# From project root
npm run rematch-all
```

This processes all 39,407 normalized offers and creates matches.

## Deploy to Vercel

Since your GitHub repo is already linked to Vercel:

1. **Push to GitHub** (if not already done)
2. **Add Environment Variables in Vercel**:
   - Go to your Vercel project settings
   - Add these variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://qkcjlbycgytlinsblrja.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key)
3. **Deploy**: Vercel will auto-deploy on push

The web app runs from the repository root.

## Troubleshooting

**"No matches found"**
- Run `npm run rematch-all` from project root first
- Check that matches exist in Supabase `matches` table

**"Failed to load data"**
- Check `.env.local` has correct Supabase credentials
- Verify Supabase project is active

**Build errors**
- Run `npm install` from repository root

