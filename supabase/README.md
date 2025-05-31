# Supabase Schema for GreaseMonkey AI

This folder contains the database schema files for GreaseMonkey AI.

## Files Overview

### Core Files
- **`complete_schema.sql`** - Complete schema for fresh setup (includes everything)
- **`existing_schema.sql`** - Documents your current database structure

### Development Files
- **`seed_data.sql`** - Sample test data

## Setup Instructions

### Option 1: Fresh Database Setup
If you're setting up a completely new database:

1. Open Supabase SQL Editor
2. Copy and paste the contents of `complete_schema.sql`
3. Run the script

This will create all tables, indexes, policies, and relationships needed for GreaseMonkey AI.

### Option 2: Existing Database
If you already have a database with some schema:

1. Review `existing_schema.sql` to see what's currently set up
2. Compare with `complete_schema.sql` to see what might be missing
3. Run any missing parts individually

## Current Schema

### Core Tables
- **`users`** - User profiles with garage info and subscription tiers
- **`queries`** - AI conversation history and car diagnostic queries

### Key Features
- Row Level Security (RLS) enabled on all tables
- Automatic timestamp management
- Optimized indexes for performance
- User isolation and data protection

## Feedback System

GreaseMonkey AI uses **Ybug** for bug reporting and feature requests. This external service:

✅ **Creates GitHub issues directly** from user feedback
✅ **Captures screenshots** automatically
✅ **No database storage needed** - everything is managed externally
✅ **Zero cost** for the feedback system
✅ **Professional issue tracking** workflow

Users can access feedback through the app settings, which opens a WebView with the Ybug widget.

## Security Notes

- All tables use Row Level Security (RLS)
- Users can only access their own data
- Authentication handled by Supabase Auth
- Admin access controlled via user tier or auth metadata

## Maintenance

- The schema is designed to be minimal and focused
- No complex feedback tables to maintain
- Simple, cost-effective architecture
