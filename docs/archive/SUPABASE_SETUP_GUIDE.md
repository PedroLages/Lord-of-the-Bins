# Supabase Setup Guide

Quick guide to get your Supabase project up and running.

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Sign in with GitHub (recommended) or email
4. Click "New project" button
5. Fill in project details:
   - **Name**: `lord-of-the-bins-prod` (or your preference)
   - **Database Password**: Generate a strong password (save it somewhere safe!)
   - **Region**: Choose closest to your users (e.g., West EU (London) for Europe)
   - **Pricing Plan**: Free tier is perfect for getting started
6. Click "Create new project"
7. Wait ~2 minutes for provisioning

## Step 2: Get Your Credentials

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. You'll see two important values:

   **Project URL**: `https://xxxxx.supabase.co`
   **anon public key**: `eyJhbGc...` (long string starting with eyJ)

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace placeholders with your actual values:
   ```env
   VITE_SUPABASE_URL=https://your-actual-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (paste your actual anon key)
   ```

3. **IMPORTANT**: Never commit the `.env` file to git! (It's already in .gitignore)

## Step 4: Run Database Migrations

We'll create the database schema using migrations. I'll prepare the SQL scripts for you.

## Step 5: Configure Supabase MCP Plugin (Optional)

To use the Supabase MCP plugin for easier management:

1. Get your **Service Role Key** (secret!) from Project Settings → API
2. Configure the MCP plugin with the access token

## Next Steps

Once you have your `.env` file configured, we'll:
1. ✅ Create the database schema (tables + RLS policies)
2. ✅ Generate TypeScript types from the schema
3. ✅ Implement the Supabase storage service
4. ✅ Build the authentication system
5. ✅ Add real-time subscriptions
6. ✅ Migrate data from IndexedDB

---

**Questions?** Check the [SUPABASE_INTEGRATION_PLAN.md](SUPABASE_INTEGRATION_PLAN.md) for the complete roadmap.
