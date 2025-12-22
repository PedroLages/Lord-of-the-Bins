# Invite System User Guide

## Overview

The invite system allows **Team Leaders** to onboard new team members by generating secure invite links. This is the recommended method for adding new users to Lord of the Bins.

## How It Works

### 1. Team Leader Generates Invite Link

**Access Invite Management:**
1. Click **Settings** in the sidebar
2. Scroll to **"User Management"** section
3. Find **"Invite New Team Members"** card

**Create an Invite:**
1. Click the **"Generate Invite Link"** button
2. Select the **Role** for the new user:
   - **Team Coordinator (TC)** - Can manage schedules and operators for their shift
   - **Team Leader** - Full access including settings and user management
3. Click **"Generate Link"**

**Share the Link:**
- A unique invite URL is created (valid for 7 days)
- **Copy the link** and share it with the new team member via:
  - Email
  - Slack/Teams message
  - Any secure communication channel
- The link looks like: `https://yourapp.com/invite/abc123def456...`

### 2. New User Accepts Invite

**Registration Process:**
1. New user clicks the invite link
2. They see a registration form with:
   - The inviting Team Leader's name
   - Pre-filled role (cannot be changed)
   - Pre-filled shift (inherited from Team Leader)
3. New user fills in:
   - **Full Name** (e.g., "Pedro Lages")
   - **User Code** (e.g., "EMP001") - Must be unique
   - **Email** (e.g., "pedro@bol.com")
   - **Password** (minimum 8 characters)
4. Click **"Accept Invite & Register"**

**What Happens:**
- Supabase Auth account is created
- User profile is created in the database
- User is automatically logged in
- The invite token is marked as used (cannot be reused)

### 3. Managing Invites

**View Pending Invites:**
In the Invite Management section, you'll see a list of:
- **Pending Invites** - Not yet accepted, still valid
- **Used Invites** - Successfully accepted
- **Expired Invites** - Older than 7 days

Each invite shows:
- Creation date
- Role assigned
- Status (Pending/Used/Expired)
- Inviting Team Leader's name

**Revoke an Invite:**
1. Find the pending invite in the list
2. Click the **"Revoke"** button (trash icon)
3. Confirm the action
4. The invite link becomes invalid immediately

## Security Features

### Invite Token Security
- Each token is a **unique, cryptographically random string**
- Tokens **expire after 7 days**
- Tokens are **single-use only** (cannot be reused after registration)
- Tokens can be **revoked at any time** by Team Leaders

### Role & Shift Isolation
- New users **inherit the shift** of the inviting Team Leader
- Role is **pre-assigned** during invite creation (cannot be changed during registration)
- Users can only see and manage data for **their assigned shift**
- Row Level Security (RLS) enforces shift isolation at the database level

### Password Requirements
- Minimum **8 characters**
- Enforced by Supabase Auth
- Passwords are **hashed and never stored in plaintext**

## Best Practices

### For Team Leaders

1. **Generate invites just-in-time** - Don't create invites far in advance
2. **Share links securely** - Use secure communication channels (email, Slack)
3. **Revoke unused invites** - If someone doesn't register within a few days, revoke and regenerate
4. **Verify user details** - After registration, check the user's profile in Settings → User Management

### For New Users

1. **Use a strong password** - Even though minimum is 8 characters, longer is better
2. **Keep your user code consistent** - Use your employee ID if you have one
3. **Contact your Team Leader** if the invite link doesn't work - It may have expired

## Troubleshooting

### "Invalid or expired invite token"
- **Cause**: The invite link is older than 7 days, was already used, or was revoked
- **Solution**: Ask your Team Leader to generate a new invite link

### "User code already exists"
- **Cause**: Another user already registered with that user code
- **Solution**: Choose a different user code (e.g., add your initials or shift number)

### "Email already in use"
- **Cause**: That email is already registered in the system
- **Solution**: Use a different email or contact your Team Leader if you forgot your password

### Invite link not working
- **Cause**: Link may be malformed or incomplete
- **Solution**: Ask Team Leader to copy the full URL again (check for line breaks in email)

## Alternative Method: Manual SQL Setup

If the invite system is unavailable, Team Leaders can contact a database administrator to manually create user accounts using SQL. See the authentication documentation for details.

## Technical Details

### Database Tables
- **`invite_tokens`** - Stores invite links with expiration and usage status
- **`users`** - Stores user profiles linked to Supabase Auth
- **`shifts`** - Defines team shifts and shift-level data isolation

### Invite Token Structure
```typescript
{
  id: string;           // UUID
  token: string;        // Unique random token
  role: 'Team Coordinator' | 'Team Leader';
  shift_id: string;     // UUID of the shift
  created_by: string;   // UUID of inviting Team Leader
  expires_at: Date;     // 7 days from creation
  used_at: Date | null; // Null if pending, timestamp if used
  used_by: string | null; // UUID of user who accepted
}
```

### Security Implementation
- Invite tokens use **`crypto.randomUUID()`** for uniqueness
- RLS policies ensure users can only manage invites for **their own shift**
- Expired tokens are automatically filtered in queries
- Used tokens cannot be reused (enforced at API level)

## Support

If you encounter issues not covered in this guide:
1. Check the application logs in the browser console (F12)
2. Contact your system administrator
3. Report bugs at: https://github.com/PedroLages/Lord-of-the-Bins/issues
