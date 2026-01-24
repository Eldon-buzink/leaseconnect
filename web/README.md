# Leaseconnect Web Dashboard

Web UI for viewing and managing vehicle offer matches.

## Setup

1. Copy environment variables from root `.env`:
   ```bash
   cp ../.env .env.local
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are automatically set from the root `.env` file.

## Deployment

The app is ready for Vercel deployment. Make sure to add environment variables in Vercel dashboard.

