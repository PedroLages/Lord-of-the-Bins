# Logout Diagnostic Guide

## Test Results

✅ **Playwright Test**: Logout button works correctly
- Successfully signs out user
- Redirects to login page
- Clears session properly

## If Logout Doesn't Work for You

### Step 1: Check Browser Console

1. Open the app in your browser
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Click the "Sign Out" button
5. **Look for errors**

### Common Issues:

#### Issue 1: Supabase Errors
If you see errors like:
```
Supabase fetch error: {code: PGRST205, details: null, hint: null, message: Could not find...}
Failed to load resource: the server responded with a status of 404
```

**Cause**: Database schema cache issue or missing migrations

**Solution**:
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run this query to refresh the schema:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. Try logging out again

#### Issue 2: Browser Cache
**Symptoms**: Logout button does nothing, or page doesn't reload

**Solution**:
1. **Hard refresh**: Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. **Clear browser cache**:
   - Chrome: Settings → Privacy and Security → Clear browsing data
   - Select "Cached images and files"
   - Time range: "Last hour"
3. Try logging out again

#### Issue 3: Service Worker Interference
**Symptoms**: Page reloads but still shows as logged in

**Solution**:
1. Open Developer Tools (`F12`)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Service Workers** in the left sidebar
4. Click **Unregister** for all service workers
5. **Hard refresh** the page (`Ctrl+Shift+R`)

#### Issue 4: Session Storage Not Clearing
**Symptoms**: After logout, refreshing the page logs you back in

**Solution**:
1. Open Developer Tools (`F12`)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage** in the left sidebar
4. Click on your site's URL
5. **Delete all keys** related to Supabase:
   - `supabase.auth.token`
   - `supabase.auth.refreshToken`
   - Any keys starting with `sb-`
6. Repeat for **Session Storage**
7. Refresh the page

#### Issue 5: CORS or Network Issues
**Symptoms**: Console shows network errors or CORS errors

**Solution**:
1. Check if Supabase is accessible: Visit your project URL in a new tab
2. Verify `.env` file has correct Supabase URL and keys
3. Check if your internet connection is stable
4. Try disabling browser extensions temporarily

### Step 2: Test Logout Function Manually

Open the browser console (`F12`) and run this:

```javascript
// Test if signOut function exists
console.log('Testing signOut...');

// Import and call signOut
import('/services/supabase/authService.js').then(({ signOut }) => {
  signOut().then(() => {
    console.log('✅ SignOut successful');
    window.location.reload();
  }).catch(err => {
    console.error('❌ SignOut failed:', err);
  });
});
```

If this works but the button doesn't, the issue is with the button click handler.

### Step 3: Check Button Click Event

Add this temporary debugging code to `App.tsx` in the `handleSignOut` function:

```typescript
const handleSignOut = useCallback(async () => {
  console.log('🔵 handleSignOut called'); // ADD THIS LINE
  try {
    console.log('🔵 Calling signOut...'); // ADD THIS LINE
    await signOut();
    console.log('🔵 signOut complete'); // ADD THIS LINE
    setCurrentUser(null);

    hybridStorage.setShiftId('');

    toast.success('Signed out successfully');

    setTimeout(() => {
      console.log('🔵 Reloading page...'); // ADD THIS LINE
      window.location.reload();
    }, 500);
  } catch (error) {
    console.error('❌ Sign out error:', error);
    toast.error('Failed to sign out');
  }
}, [toast]);
```

After adding these logs:
1. Save the file
2. Reload the app
3. Click "Sign Out"
4. **Check console** for the blue circle emojis 🔵
5. **Tell me which log lines appear**

### Step 4: Database Diagnostics

Run this query in your Supabase SQL Editor to check if RLS is causing issues:

```sql
-- Check if your user has proper permissions
SELECT
  auth.uid() as current_user_id,
  COUNT(*) as profile_count
FROM users
WHERE id = auth.uid();

-- Should return 1 row with profile_count = 1
-- If profile_count = 0, your profile is missing
-- If profile_count > 1, you have duplicate profiles (BUG!)
```

### Step 5: Nuclear Option - Complete Reset

If nothing works:

1. **Sign out all sessions** via Supabase Dashboard:
   - Go to Authentication → Users
   - Find your user
   - Click "..." → **Sign out all sessions**

2. **Clear ALL browser data**:
   - Chrome: Settings → Privacy → Clear browsing data
   - Select **ALL TIME**
   - Check ALL boxes
   - Click "Clear data"

3. **Restart browser**

4. **Try logging in again**

## Report Back

After trying these steps, please report:

1. **Which step fixed it** (if any)
2. **Console errors** you saw (copy/paste)
3. **Browser and version** you're using
4. **Any unusual behavior**

## Quick Fix (Temporary Workaround)

If you need to sign out immediately while debugging:

1. Open Developer Tools (`F12`)
2. Go to **Application** tab
3. **Local Storage** → Your site URL → **Clear All**
4. **Session Storage** → Your site URL → **Clear All**
5. **Refresh page** (`F5`)

This manually clears the session and logs you out.
