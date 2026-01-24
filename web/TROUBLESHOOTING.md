# Troubleshooting Web UI

## Server Not Starting

### Check if server is running:
```bash
cd web
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
```

### Port Already in Use

If port 3000 is busy:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

## Page Shows "Loading..." Forever

### Check Browser Console

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Check Console tab for errors
3. Check Network tab for failed requests

### Common Issues

**"Failed to load data"**
- Check `.env.local` has correct Supabase credentials
- Verify Supabase project is active
- Check browser console for specific error

**"No matches found"**
- This is normal if you haven't run matching yet
- Run `npm run rematch-all` from project root
- Refresh browser

**CORS Errors**
- Supabase should handle CORS automatically
- Check Supabase project settings → API → CORS

## Environment Variables

Make sure `.env.local` exists in `web/` directory:

```bash
cd web
cat .env.local
```

Should show:
```
NEXT_PUBLIC_SUPABASE_URL=https://qkcjlbycgytlinsblrja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## Rebuild After Changes

If you make code changes:
```bash
cd web
npm run build
npm run dev
```

## Check Server Logs

The terminal running `npm run dev` will show:
- Compilation errors
- Runtime errors
- Request logs

Look for red error messages.

