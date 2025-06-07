# Stripe Integration Setup Guide

This guide walks you through setting up Stripe for your GreaseMonkey AI hybrid pricing model.

## 🎯 **Overview**

Your app has 3 pricing tiers:
- **Free**: 3 questions/day, 1 vehicle (no payment)
- **Weekend Warrior**: $0.15 per question, 3 vehicles (usage-based)
- **Master Tech**: $25/month or $250/year, unlimited (subscription)

## 📋 **Prerequisites**

1. Stripe account (free at stripe.com)
2. Your PWA app running locally or deployed
3. Access to your app's environment variables

## 🚀 **Step 1: Create Stripe Products**

### 1.1 Weekend Warrior (Usage-Based)
This plan uses payment methods setup but charges per-use.
- No product needed in Stripe dashboard
- Uses Payment Intents for individual charges

### 1.2 Master Tech Plans (Subscription)

In your Stripe Dashboard:

1. Go to **Products** → **Add Product**
2. Create **Master Tech Monthly**:
   - Product name: `Master Tech Monthly`
   - Price: `$25.00 USD`
   - Billing: `Recurring`
   - Interval: `Monthly`
   - Copy the **Price ID** (starts with `price_`)

3. Create **Master Tech Yearly**:
   - Product name: `Master Tech Yearly`
   - Price: `$250.00 USD`
   - Billing: `Recurring`
   - Interval: `Yearly`
   - Copy the **Price ID** (starts with `price_`)

## 🔑 **Step 2: Get API Keys**

In Stripe Dashboard → **Developers** → **API Keys**:

1. Copy **Publishable key** (starts with `pk_test_` or `pk_live_`)
2. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)

## 🔧 **Step 3: Configure Environment Variables**

Update your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Product Price IDs (from Step 1)
STRIPE_MASTER_TECH_MONTHLY_PRICE_ID=price_1234567890abcdef
STRIPE_MASTER_TECH_YEARLY_PRICE_ID=price_0987654321fedcba
```

## 🪝 **Step 4: Setup Webhooks**

Webhooks keep your app in sync with Stripe events.

### 4.1 Create Webhook Endpoint

In Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**:

1. **Endpoint URL**: `https://yourdomain.com/api/stripe/webhook`
2. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `setup_intent.succeeded`

3. Click **Add endpoint**
4. Copy the **Signing secret** (starts with `whsec_`)
5. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

### 4.2 Test Webhook (Local Development)

Install Stripe CLI:
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget -O - https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee -a /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe
```

Forward events to local development:
```bash
# Login to Stripe CLI
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret from the CLI output to your `.env.local`.

## 💾 **Step 5: Database Setup**

Run the Supabase migration:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the SQL in your Supabase SQL editor
```

The migration adds these fields to your `users` table:
- `stripe_customer_id`
- `stripe_payment_method_id`
- `subscription_status`
- `subscription_id`
- `subscription_start_date`
- `subscription_end_date`

## 📦 **Step 6: Install Dependencies**

```bash
cd pwa
npm install stripe @stripe/stripe-js
```

## 🧪 **Step 7: Test the Integration**

### 7.1 Test Cards

Use these test card numbers:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

### 7.2 Test Scenarios

1. **Free User**: Should work without any payment setup
2. **Weekend Warrior**:
   - Click "Set Up Billing" → goes to Stripe checkout
   - Complete payment method setup
   - Ask questions → charges $0.15 each
3. **Master Tech**:
   - Click "Upgrade to Master Tech" → goes to Stripe checkout
   - Complete subscription → redirected to success page
   - User tier updates in database

## 🔍 **Step 8: Monitor in Stripe Dashboard**

Check these sections:
- **Payments**: See individual question charges (Weekend Warrior)
- **Subscriptions**: See Master Tech subscriptions
- **Customers**: See all your users
- **Logs**: Debug webhook deliveries

## 🐛 **Troubleshooting**

### Common Issues:

1. **"Cannot find module 'stripe'"**
   - Run `npm install` in the pwa directory

2. **"Invalid API key"**
   - Check your `.env.local` has the correct keys
   - Restart your development server

3. **Webhook events not received**
   - Check webhook URL is correct
   - Verify webhook secret in environment variables
   - Check Stripe CLI is forwarding (local dev)

4. **User tier not updating**
   - Check webhook handler logs
   - Verify Supabase migration ran
   - Check database permissions

### Debug Mode:

Add to your webhook handler for debugging:
```typescript
console.log('Webhook event:', event.type, event.data.object)
```

## 🚀 **Production Deployment**

1. **Switch to Live Keys**: Replace test keys with live keys
2. **Update Webhook URL**: Point to your production domain
3. **Test with Real Cards**: Use small amounts first
4. **Monitor Closely**: Watch Stripe dashboard for the first few transactions

## 💡 **Next Steps**

- Set up Stripe billing portal for customers to manage subscriptions
- Add usage reporting dashboard
- Implement subscription upgrade/downgrade flows
- Add annual discount promotions

---

Your hybrid pricing model is now ready! Users can choose free tier, pay-per-use, or monthly/yearly subscriptions. 🎉
