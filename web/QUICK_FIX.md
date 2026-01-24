# Quick Fix for "Nothing Happens" Issue

## Most Likely Issue: Server Not Running

**Make sure the dev server is actually running:**

1. Open a terminal
2. Run:
   ```bash
   cd web
   npm run dev
   ```

3. **Wait for this message:**
   ```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:3000
   ✓ Ready in X seconds
   ```

4. **THEN** open http://localhost:3000 in your browser

## If Server IS Running But Page Is Blank

### Check Browser Console

1. Open browser DevTools:
   - **Mac:** Cmd + Option + I
   - **Windows/Linux:** F12

2. Click **Console** tab

3. Look for **red error messages**

4. Common errors:
   - "Failed to fetch" → Supabase connection issue
   - "Cannot read property" → JavaScript error
   - "Network error" → Check internet/Supabase

### Check Network Tab

1. In DevTools, click **Network** tab
2. Refresh the page (F5)
3. Look for **red/failed requests**
4. Click on failed requests to see error details

### Quick Test

Try this in browser console (F12 → Console):
```javascript
fetch('http://localhost:3000')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error)
```

If this works, the server is running but React might have an error.

## Still Not Working?

1. **Kill and restart server:**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   
   # Restart
   cd web
   npm run dev
   ```

2. **Check for build errors:**
   ```bash
   cd web
   npm run build
   ```

3. **Clear Next.js cache:**
   ```bash
   cd web
   rm -rf .next
   npm run dev
   ```

4. **Check environment variables:**
   ```bash
   cd web
   cat .env.local
   ```
   Should show Supabase URL and key.

