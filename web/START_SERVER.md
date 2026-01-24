# How to Start the Web UI

## Step 1: Start the Server

Open a terminal and run:

```bash
cd web
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

## Step 2: Open Browser

Open your browser and go to:
**http://localhost:3000**

## Step 3: Check What You See

### If you see "No matches found":
This is normal! You need to run matching first:
```bash
# In a new terminal, from project root
npm run rematch-all
```

### If you see "Loading..." forever:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. See TROUBLESHOOTING.md for help

### If you see an error:
- Check `.env.local` exists in `web/` directory
- Verify Supabase credentials are correct
- Check server terminal for error messages

## Common Issues

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Environment variables missing:**
```bash
cd web
./setup-env.sh
npm run dev
```

**Build errors:**
```bash
cd web
npm install
npm run build
npm run dev
```

