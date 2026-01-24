# Web UI Troubleshooting

## 🌐 Localhost Address

**http://localhost:3000**

## ⚠️ "Nothing Happens" - Common Causes

### 1. Server Not Running

**Check:** Is there a terminal running `npm run dev`?

**Fix:**
```bash
cd web
npm run dev
```

**Wait for:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

**THEN** open http://localhost:3000

### 2. Page Shows "Loading..." Forever

**Check browser console:**
1. Press **F12** (or **Cmd+Option+I** on Mac)
2. Click **Console** tab
3. Look for **red errors**

**Common errors:**
- "Failed to fetch" → Supabase connection issue
- "Cannot read property" → JavaScript error
- Check Network tab for failed API calls

### 3. Blank Page

**Check:**
1. Browser console for errors
2. Server terminal for errors
3. Network tab in DevTools

**Fix:**
```bash
cd web
rm -rf .next
npm run build
npm run dev
```

### 4. Port Already in Use

**Fix:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Restart
cd web
npm run dev
```

## 🔍 Debugging Steps

### Step 1: Verify Server is Running

```bash
curl http://localhost:3000
```

Should return HTML (not "connection refused")

### Step 2: Check Browser Console

1. Open http://localhost:3000
2. Press F12
3. Check Console tab
4. Look for errors (red text)

### Step 3: Check Network Requests

1. In DevTools, click **Network** tab
2. Refresh page (F5)
3. Look for failed requests (red)
4. Click on them to see error details

### Step 4: Check Environment Variables

```bash
cd web
cat .env.local
```

Should show:
```
NEXT_PUBLIC_SUPABASE_URL=https://qkcjlbycgytlinsblrja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## ✅ Expected Behavior

When working correctly, you should see:

1. **Dashboard loads** (even if no data)
2. **Statistics cards** show numbers (or 0)
3. **Table shows** "No matches found" or list of matches
4. **No errors** in browser console

## 🆘 Still Not Working?

1. **Check server logs** - Look at terminal running `npm run dev`
2. **Check browser console** - F12 → Console tab
3. **Try different browser** - Sometimes cache issues
4. **Clear browser cache** - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

## 📝 Quick Test

Run this in browser console (F12 → Console):
```javascript
console.log('Test');
fetch('http://localhost:3000')
  .then(r => r.text())
  .then(html => console.log('Server response:', html.substring(0, 100)))
  .catch(err => console.error('Error:', err));
```

If this shows HTML, server is working. If it shows error, server isn't running.

