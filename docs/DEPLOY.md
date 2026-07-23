# QuickRide Deployment Guide

## Step 1: Supabase Setup (5 min)
1. Go to https://supabase.com/dashboard/sign-up
2. Create new project (name: quickride)
3. Go to SQL Editor
4. Run migration: supabase/migrations/001_initial.sql
5. Copy: Settings > API > Project URL + anon key

## Step 2: Deploy to Render (10 min)
1. Go to https://render.com
2. Connect GitHub: KingKaonix/quickride
3. Create Web Service
4. Settings:
   - Name: quickride
   - Runtime: Node
   - Build: npm install
   - Start: node server.js
5. Add env vars:
   - SUPABASE_URL=your-url
   - SUPABASE_ANON_KEY=your-key
   - STRIPE_SECRET_KEY=your-key
6. Deploy

## Step 3: Stripe Setup (10 min)
1. https://dashboard.stripe.com
2. Create account (free)
3. Get API keys
4. Add to Render env
5. Enable Connect for marketplace

## Revenue Model
- 10% commission per booking
- $29/mo premium listings
- $49/mo featured placement
- Stripe: 2.9% + $0.30
