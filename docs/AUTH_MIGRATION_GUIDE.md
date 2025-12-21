# Authentication Migration Guide

## Overview

This document describes the migration from Supabase authentication back to local IndexedDB authentication.

## What Changed

### Before (Supabase Auth)
- **Login Method**: User Code OR Email
- **Examples**: `EMP001`, `tc-giedrius`, `user@example.com`
- **Storage**: Supabase cloud database with Row Level Security
- **Session**: Managed by Supabase client
- **Password Reset**: Magic link via email

### After (Local Auth)
- **Login Method**: Numeric Batch Number only
- **Example**: `12345`, `99001`
- **Storage**: IndexedDB (browser local storage)
- **Session**: Managed locally with 24-hour expiry
- **Password Reset**: Not currently supported (admin must reset)

## Breaking Changes

### 1. Login Credentials Changed
- **Old**: Supported alphanumeric user codes (`EMP001`) and emails
- **New**: **Numeric batch numbers only** (e.g., `12345`)

### 2. User Data Storage
- **Old**: Data stored in Supabase, shared across devices
- **New**: Data stored locally in browser (not synced across devices)

### 3. Shift Isolation
- **Old**: Row Level Security enforced at database level
- **New**: Application-level filtering (team assignment determines visible data)

## Migration Steps for Users

### For Administrators

1. **Export Existing Data** (if needed):
   ```
   Settings → Export → Download full data backup
   ```

2. **Create New Users** with numeric batch numbers:
   - Old: User code `TC-GIEDRIUS`
   - New: Batch number `10001`

3. **Communicate Changes** to team:
   - Inform users of new numeric login format
   - Provide each user with their batch number and temporary password
   - Users should change password after first login

### For End Users

1. **First Login** after migration:
   - Use the numeric batch number provided by your admin
   - Enter the temporary password
   - Go to Settings → Profile to change your password

2. **Browser Requirements**:
   - Each browser/device requires separate login
   - Clearing browser data will require re-login
   - Private/incognito mode will not persist data

## Technical Details

### Authentication Service
- **File**: `services/authService.ts`
- **Method**: Username/password stored in IndexedDB
- **Hashing**: Passwords are hashed before storage
- **Session**: 24-hour expiry, stored in sessionStorage

### Data Access
- **Storage**: IndexedDB databases scoped per shift
- **Isolation**: Users only see data for their assigned shift
- **Backup**: Users should export data regularly

### Security Considerations

1. **No Server-Side Validation**
   - All auth logic runs in browser
   - Users with browser dev tools could potentially access all data

2. **No Cross-Device Sync**
   - Each device maintains separate local data
   - Changes on one device don't sync to others

3. **Data Loss Risk**
   - Clearing browser data = losing all schedules/operators
   - Regular exports recommended

## Reverting to Supabase (If Needed)

If you need to revert to Supabase authentication:

1. **Checkout previous commit**:
   ```bash
   git checkout <commit-before-reversion>
   ```

2. **Restore Supabase configuration**:
   ```bash
   cp .env.example .env
   # Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```

3. **Run migrations**:
   ```bash
   # Apply SQL migrations in supabase/migrations/ to your Supabase project
   ```

## FAQ

**Q: Can I use my old user code?**
A: No, the new system only accepts numeric batch numbers.

**Q: What if I forget my password?**
A: Contact your Team Leader to reset your password.

**Q: Will my existing schedules be preserved?**
A: If you export before migration and import after, yes. Otherwise, data is local to each browser.

**Q: Can I access the app from multiple devices?**
A: Yes, but each device will have independent data. Changes on one device won't sync to others.

**Q: Is this change permanent?**
A: The development team can decide to re-enable Supabase integration in the future if needed.

## Support

For issues with authentication migration, contact your Team Leader or the development team.
