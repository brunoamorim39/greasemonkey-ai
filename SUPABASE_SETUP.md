# GreaseMonkey AI - Supabase Setup Guide

## Quick Setup Steps

### 1. Create New Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in/up
2. Click "New Project"
3. Choose organization and set project name: `greasemonkey-ai`
4. Set a secure database password
5. Select region closest to your users
6. Wait for project to initialize (~2 minutes)

### 2. Configure Environment Variables
1. In your Supabase dashboard, go to Settings > API
2. Copy your Project URL and anon/public key
3. Create `pwa/.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Add your other environment variables below...
# OpenAI, ElevenLabs, etc.
```

### 3. Set Up Database Schema
1. In Supabase dashboard, go to SQL Editor
2. Copy the entire contents of `supabase/fresh-schema.sql`
3. Paste into a new query and run it
4. This will create all tables, functions, and security policies

### 4. Configure Authentication
1. In Supabase dashboard, go to Authentication > Settings
2. **Site URL**: Set to your domain (e.g., `https://your-app.com`)
3. **Redirect URLs**: Add your domain + `/auth/callback`
4. For development, also add: `http://localhost:3000`

### 5. Configure Email Templates (Optional)
1. Go to Authentication > Email Templates
2. Customize confirmation and password reset emails
3. Add your app branding and styling

## Database Schema Overview

The fresh schema creates these tables with your pricing structure:

### User Profiles
- Extends Supabase auth.users
- Tracks user tier: `free_tier`, `weekend_warrior`, `master_tech`

### Vehicles
- User's garage with make, model, year, nickname, etc.
- Supports unlimited vehicles for master_tech tier

### Documents
- File uploads with categories
- Linked to specific vehicles
- Storage quotas by tier

### Usage Logs
- Tracks questions, uploads, costs
- Enforces daily limits (free: 3/day)
- Tracks monthly limits (master_tech: 100/month)
- Tracks pay-per-use costs (weekend_warrior: $0.15/question)

### Conversations
- Chat history scoped to vehicles
- Audio response URLs
- Automatically cleaned up per RLS policies

## Pricing Enforcement

The schema includes functions to enforce your pricing tiers:

- **Free Tier**: 3 questions/day, 1 vehicle, no document uploads
- **Weekend Warrior**: Pay $0.15/question, 3 vehicles, 20 docs per vehicle
- **Master Tech**: 100 questions/month, unlimited vehicles & docs

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- System functions can log usage across users
- Storage policies prevent unauthorized file access

## Next Steps

1. Run the schema setup
2. Test authentication signup/signin
3. Verify tier enforcement
4. Configure your payment processor (Stripe) for weekend_warrior
5. Set up usage monitoring and alerts

## Testing

To test your setup:

1. Sign up a new user
2. Check that user_profile is created automatically
3. Try creating vehicles (should be limited by tier)
4. Test question limits
5. Verify document upload restrictions

## Troubleshooting

**Database connection issues:**
- Check your `.env.local` file has correct URL and key
- Verify project is active in Supabase dashboard

**Authentication not working:**
- Check Site URL and Redirect URLs in auth settings
- Verify email confirmation is working

**RLS blocking queries:**
- Check that policies are correctly applied
- Verify user is authenticated when making requests

**Usage limits not working:**
- Check that usage logging functions are being called
- Verify user tier is set correctly in user_profiles table
