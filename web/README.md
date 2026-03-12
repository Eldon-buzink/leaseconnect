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
   - **From project root (recommended):** `npm run dev` — starts the web app and shows the URL.
   - **From this folder:** `npm run dev`.
   Open the URL shown in the terminal (e.g. http://localhost:3000). If you see 404s, you are on the wrong port—use the URL the terminal prints.

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (for car thumbnails from Imagin.studio):
- `NEXT_PUBLIC_IMAGIN_CUSTOMER_KEY` – your Imagin customer key. If set, car images are loaded from Imagin CDN; otherwise a placeholder is shown.

## Deployment

The app is ready for Vercel deployment. Make sure to add environment variables in Vercel dashboard.

