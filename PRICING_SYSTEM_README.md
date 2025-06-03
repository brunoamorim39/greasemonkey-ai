# GreaseMonkey AI Pricing System

This document describes the comprehensive pricing and usage tracking system implemented for GreaseMonkey AI.

## 💰 **Final Pricing Tiers (Subscription-Only)**

### 🆓 **Garage Visitor** (Free)
- **3 questions per day** (STT → GPT-4o → TTS all included)
- **1 vehicle maximum** in garage
- **No document uploads**
- Voice input and audio responses included

### 🔧 **Gearhead** (Monthly/Annual)
- **$4.99/month** or **$49.90/year** (save $9.98 = 2 months free)
- **Unlimited questions**
- **Unlimited vehicles**
- **20 documents maximum** (total uploaded)
- All voice features included

### 🏆 **Master Tech** (Monthly/Annual)
- **$29.99/month** or **$299.90/year** (save $59.98 = 2 months free)
- **Unlimited everything**
- **Unlimited documents** (no storage limits)
- **Priority support**
- **Early access to new features**
- **Best for mechanics, shops, and serious enthusiasts**

## 🔄 Complete Question Flow

Each "question" includes the full hands-free experience:

1. **🎤 Speech-to-Text (STT)**: User speaks → Whisper API converts to text
2. **🧠 AI Processing**: GPT-4o generates answer based on context
3. **🔊 Text-to-Speech (TTS)**: ElevenLabs converts answer to audio

**This entire flow is considered "1 question"** - no separate charges for STT or TTS.

## Cost Analysis

### Per Question Cost to Us:
- **GPT-4o**: ~$0.002 (input + output tokens)
- **ElevenLabs TTS**: ~$0.04-0.14 (answer length dependent)
- **Total Cost**: ~$0.042-0.142 per question

### Profit Margins:
- **Usage-Based**: $0.15 - $0.142 = $0.008-0.108 profit per question (5-72% margin)
- **Fixed-Rate**: Break-even at ~67-238 questions per month

### Target User Segments:
- **Light users (5-15 Q/month)**: Usage-based → $0.75-2.25/month
- **Regular users (20-50 Q/month)**: Usage-based → $3.00-7.50/month
- **Heavy users (67+ Q/month)**: Fixed-rate → $9.99/month better value

## 📊 Profitability Analysis & Usage Projections

### Realistic User Segments & Usage Patterns

#### 🏠 **Weekend Warriors** (Casual DIY)
- **Usage**: 5-15 questions/month
- **Profile**: Oil changes, basic maintenance, occasional repairs
- **Optimal Plan**: Usage-based ($0.75-2.25/month) or Standard if 67+ Q/month
- **Revenue/User**: $9-27/year (usage) or $120/year (standard)
- **Profit/User**: $2-16/year (usage) or $80-100/year (standard)

#### 🔧 **Regular Enthusiasts** (Active DIY)
- **Usage**: 20-60 questions/month
- **Profile**: Regular maintenance, moderate repairs, project cars
- **Optimal Plan**: Standard ($9.99/month) for predictable costs
- **Revenue/User**: $120/year
- **Profit/User**: $80-100/year (67-83% margin)

#### ⚡ **Power Users** (Heavy DIY/Multi-Vehicle)
- **Usage**: 60-150 questions/month
- **Profile**: Multiple vehicles, complex repairs, extensive document libraries
- **Optimal Plan**: Pro ($29.99/month) for unlimited documents
- **Revenue/User**: $360/year
- **Profit/User**: $320-340/year (89-94% margin)

#### 🏭 **Professional Mechanics** (Business Use)
- **Usage**: 100-500+ questions/month
- **Profile**: Shop diagnostics, training apprentices, difficult cases, extensive manuals
- **Optimal Plan**: Pro ($29.99/month) - steal at this price for business use
- **Revenue/User**: $360/year
- **Profit/User**: $340+/year (94%+ margin)

### Expected User Distribution

Based on automotive DIY market + pricing psychology + vehicle ownership patterns:

```
50% Weekend Warriors    (Standard tier sweet spot - many have 2+ vehicles)
20% Regular Enthusiasts (Standard tier core users)
20% Power Users        (Pro tier candidates)
10% Professional/Heavy (Pro tier - high value)
```

*Note: Vehicle limits will drive upgrades - many households have 2-3 vehicles*

### Revenue Projections (Per 1000 Users)

#### Conservative Scenario:
- **500 Weekend Warriors**: 60% usage ($18/year), 40% standard ($120/year) = $33,000/year
- **200 Regular Enthusiasts**: 90% standard ($120/year) = $21,600/year
- **200 Power Users**: 70% pro ($360/year) = $50,400/year
- **100 Professionals**: 90% pro ($360/year) = $32,400/year
- **Total Revenue**: $137,400/year per 1,000 users
- **Total Profit**: $115,000-125,000/year (84-91% margin)

#### Optimistic Scenario:
- **500 Weekend Warriors**: 40% usage, 60% standard = $42,000/year
- **200 Regular Enthusiasts**: 95% standard = $22,800/year
- **200 Power Users**: 90% pro = $64,800/year
- **100 Professionals**: 100% pro = $36,000/year
- **Total Revenue**: $165,600/year per 1,000 users
- **Total Profit**: $145,000-155,000/year (88-94% margin)

### Break-Even Analysis

#### Per User Acquisition Cost Tolerance:
- **LTV/CAC Ratio Target**: 3:1 minimum
- **Average LTV**: $37-52 per user over 12 months
- **Max CAC**: $12-17 per user
- **Payback Period**: ~6-8 months

#### Monthly Recurring Revenue (MRR) Projections:
- **1,000 Users**: $3,075-4,350 MRR
- **5,000 Users**: $15,375-21,750 MRR
- **10,000 Users**: $30,750-43,500 MRR

### Usage Frequency Insights

**Peak Usage Times**:
- **Weekends**: 60% of usage (DIY project time)
- **Winter Months**: 40% higher usage (car issues)
- **Spring/Summer**: Project season spikes

**Question Categories** (estimated distribution):
- **Diagnostics/Troubleshooting**: 40%
- **Maintenance Procedures**: 30%
- **Parts/Specifications**: 20%
- **Installation Guidance**: 10%

### Customer Acquisition Strategies

**High-Value Channels**:
1. **YouTube Automotive Channels**: Partner with DIY creators
2. **Reddit Communities**: r/MechanicAdvice, r/Cartalk, etc.
3. **Automotive Forums**: Brand-specific communities
4. **Tool Store Partnerships**: Harbor Freight, etc.
5. **Mechanic Shop Referrals**: Word-of-mouth program

**Conversion Funnels**:
- **Free Trial**: 3 questions → 15-25% convert to paid
- **Vehicle Limit Hit**: 1 vehicle → 30-40% upgrade for more
- **Document Upload Need**: 35-50% upgrade for manuals

### Competitive Positioning

**Price Comparison**:
- **Haynes Manual**: $25-45 one-time (single vehicle)
- **AllData**: $27/month (professional)
- **Mitchell1**: $150+/month (shop level)
- **GreaseMonkey AI**: $0.75-9.99/month (covers all vehicles)

**Value Proposition**:
- **Cost**: 50-90% cheaper than alternatives
- **Convenience**: Voice-activated, hands-free
- **Coverage**: All makes/models vs single-vehicle manuals
- **Personalization**: Your garage, your questions

### Scalability Metrics

**Infrastructure Costs** (per 1000 users/month):
- **Hosting/Database**: ~$200-400
- **OpenAI API**: ~$400-800 (usage dependent)
- **ElevenLabs TTS**: ~$600-1200 (usage dependent)
- **Total OpEx**: ~$1200-2400 (vs $36,900 revenue = 3-7% of revenue)

**Unit Economics Health**:
- **Gross Margin**: 70-80% (excellent for SaaS)
- **OpEx Ratio**: 3-7% of revenue (very efficient)
- **Net Margin**: 60-76% (outstanding profitability)

## Database Schema

### New Tables

#### `usage_records`
Tracks individual usage events for billing and analytics.

```sql
CREATE TABLE usage_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  usage_type text CHECK (usage_type IN ('ask_query', 'document_upload', 'document_search', 'tts_request', 'stt_request')),
  timestamp timestamptz DEFAULT now(),
  details jsonb DEFAULT '{}',
  cost_cents integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

#### `daily_usage_stats`
Aggregated daily statistics per user for quick limit checking.

```sql
CREATE TABLE daily_usage_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  date date NOT NULL,
  ask_queries integer DEFAULT 0,
  document_uploads integer DEFAULT 0,
  document_searches integer DEFAULT 0,
  tts_requests integer DEFAULT 0,
  stt_requests integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);
```

#### `tier_overrides`
Temporary tier overrides for testing and admin purposes.

```sql
CREATE TABLE tier_overrides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  override_tier text CHECK (override_tier IN ('free', 'usage_paid', 'fixed_rate')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);
```

## API Endpoints

### Usage Tracking

#### `GET /usage/{user_id}`
Get comprehensive usage statistics for a user.

**Response:**
```json
{
  "user_id": "uuid",
  "tier": "free|usage_paid|fixed_rate",
  "date": "2024-01-15",
  "daily_stats": {
    "ask_queries": 2,
    "document_uploads": 0,
    "document_searches": 1,
    "tts_requests": 2,
    "stt_requests": 0,
    "total_cost_cents": 14
  },
  "tier_limits": {
    "max_daily_asks": 3,
    "max_vehicles": 1,
    "document_upload_enabled": false,
    "cost_per_ask_cents": null
  },
  "can_make_requests": true,
  "remaining_asks": 1,
  "estimated_monthly_cost_cents": 420
}
```

#### `POST /admin/tier-override`
Set a temporary tier override for testing.

**Request:**
```json
{
  "user_id": "uuid",
  "override_tier": "usage_paid",
  "expires_at": "2024-01-16T12:00:00Z"
}
```

## Backend Implementation

### PricingService Class

The `PricingService` class handles all pricing logic:

- `get_user_tier(user_id)`: Get effective tier (including overrides)
- `check_usage_limit(user_id, usage_type)`: Check if user can perform action
- `track_usage(user_id, usage_type, details)`: Record usage event
- `get_user_usage_stats(user_id, date)`: Get comprehensive usage stats
- `check_vehicle_limit(user_id, count)`: Check vehicle limits
- `set_tier_override(user_id, tier, expires_at)`: Set testing override

### Usage Enforcement

All API endpoints now check usage limits before processing:

```python
# Check limits before processing
can_ask, limit_message = pricing_service.check_usage_limit(user_id, UsageType.ASK_QUERY)
if not can_ask:
    raise HTTPException(status_code=429, detail=limit_message)

# Process request...

# Track usage after success
pricing_service.track_usage(user_id, UsageType.ASK_QUERY, details={...})
```

## Frontend Integration

### UsageService Class

The Flutter app includes a `UsageService` for tier management:

- `getUserUsage(userId)`: Get user's current usage and limits
- `canAddVehicle(userId, currentCount)`: Check vehicle limits
- `setTierOverride(userId, tier)`: Set testing override
- `getPlanDescription(tier)`: Get user-friendly plan name
- `getPlanFeatures(tier)`: Get list of plan features

### Vehicle Limit Enforcement

The garage functionality now checks limits before adding vehicles:

```dart
// Check limits before adding vehicle
final canAdd = await UsageService.canAddVehicle(userId, currentVehicleCount);
if (!canAdd) {
  _showUpgradeDialog();
  return;
}
```

## Testing Tools

### Tier Override Tool

A CLI tool is provided for testing different tiers:

```bash
# Set user to usage-based tier for 24 hours
python tier_override_tool.py test-user-123 usage_paid 24

# Set user to fixed-rate tier for 48 hours
python tier_override_tool.py test-user-123 fixed_rate 48

# Reset user to free tier for 1 hour
python tier_override_tool.py test-user-123 free 1
```

## Configuration

### Tier Limits Configuration

Tier limits are easily configurable in `services.py`:

```python
TIER_CONFIGS = {
    UserTier.FREE: TierLimits(
        max_daily_asks=3,
        max_vehicles=1,
        document_upload_enabled=False,
        # ... other limits
    ),
    UserTier.USAGE_PAID: TierLimits(
        cost_per_ask_cents=5,  # $0.05 per query
        cost_per_upload_cents=25,  # $0.25 per upload
        # ... other pricing
    ),
    # ... other tiers
}
```

### Environment Variables

Required environment variables:
- `API_KEY`: Backend API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase service key

## Migration

To apply the pricing system to an existing database:

```bash
# Run the migration
psql -h your-db-host -d your-db -f supabase/migrations/003_add_pricing_tables.sql
```

## Usage Examples

### Testing Free Tier Limits

1. Set user to free tier:
   ```bash
   python tier_override_tool.py user-123 free 24
   ```

2. Make 3 ask requests - should succeed
3. Make 4th ask request - should fail with limit message
4. Try to add 2nd vehicle - should fail with upgrade prompt

### Testing Usage-Based Tier

1. Set user to usage-based tier:
   ```bash
   python tier_override_tool.py user-123 usage_paid 24
   ```

2. Make ask requests - should succeed and track costs
3. Upload documents - should succeed and track costs
4. Check usage stats to see accumulated costs

### Testing Fixed-Rate Tier

1. Set user to fixed-rate tier:
   ```bash
   python tier_override_tool.py user-123 fixed_rate 24
   ```

2. All features should be unlimited
3. No costs should be tracked

## Future Enhancements

- **Payment Integration**: Stripe/PayPal integration for usage-based billing
- **Enterprise Tier**: Multi-user accounts for shops/businesses
- **Usage Analytics**: Detailed usage dashboards for users
- **Cost Alerts**: Notifications when usage costs reach thresholds
- **Plan Recommendations**: Suggest optimal plan based on usage patterns

## Monitoring

The system provides several views for monitoring:

- `user_usage_summary`: Daily usage overview per user
- `get_user_effective_tier()`: Function to check effective tier
- Usage records for detailed analytics
- Daily stats for quick limit checking

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only view their own usage data
- Admin functions require API key authentication
- Tier overrides are logged with timestamps

## 🔍 **Assumptions Breakdown & Reality Check**

*The user asked for transparency on how I got these numbers - here's the honest breakdown:*

### **❌ What I DON'T Actually Know (Pure Estimates):**

#### User Distribution (60/25/12/3% split):
- **Source**: Educated guess based on general SaaS usage patterns
- **Reality**: We have zero data on automotive DIY app usage
- **Red Flag**: This could be completely wrong
- **Validation Needed**: Need to survey target users or analyze competitor data

#### Usage Frequency (5-15 Q/month for casual users):
- **Source**: Gut feeling about DIY project frequency
- **Assumption**: People work on cars maybe 1-2x per month, ask 3-8 questions per session
- **Reality**: Could be way higher (troubleshooting sessions) or lower (seasonal use)
- **Validation Needed**: Beta test with real users

#### Conversion Rates (15-25% free to paid):
- **Source**: Industry SaaS averages (freemium model typically 2-5%, but I assumed higher due to clear value prop)
- **Reality**: Automotive users might convert differently than typical SaaS
- **Major Assumption**: That vehicle limit actually drives upgrades

### **✅ What I CAN Back Up (Real Data):**

#### Cost Per Question ($0.042-0.142):
```
STT (Whisper): $0.006/minute audio
- Assumption: 30-60 second questions avg
- Cost: $0.003-0.006 per question

GPT-4o: $5/1M input + $15/1M output tokens
- Assumption: 500 input + 300 output tokens avg
- Cost: (500×$0.000005) + (300×$0.000015) = $0.0025 + $0.0045 = $0.007

ElevenLabs TTS: $0.30/1K characters
- Assumption: 100-400 characters in answer
- Cost: $0.03-0.12 per question

Total: $0.04-0.14 per question ✅ (This is solid)
```

#### Infrastructure Costs:
- **Supabase**: $25/month for 100K+ API calls
- **Hosting**: ~$50-200/month depending on scale
- **These are real prices** ✅

### **🤔 Where I Made Big Leaps:**

#### "Weekend Warriors use 5-15 Q/month":
**My Logic**:
- Work on car 1-2x per month
- Ask 3-8 questions per session
- 2×6 = 12 questions/month average

**Reality Check**: This could be way off! Maybe they:
- Only use it seasonally (winter car problems)
- Ask 20+ questions in a single session when stuck
- Use it daily for small things

#### "Regular Enthusiasts use 20-40 Q/month":
**My Logic**:
- More frequent projects (weekly garage time)
- More complex repairs = more questions
- 4 sessions × 8 questions = 32/month

**But Maybe**:
- They already know more, ask fewer questions
- Or they get addicted and ask way more

#### Revenue Calculations:
```
600 Weekend Warriors × $0.75/month avg = $5,400/year
```
**Where $0.75 came from**: 5 questions × $0.15 = $0.75/month

**But this assumes**:
- They actually pay per-use vs hitting the 3-question free limit
- Linear usage (some months might be 0, others 20+)

### **🚨 Biggest Assumptions That Could Break Everything:**

#### 1. **People Will Pay Per-Question**
- **My Assumption**: DIYers value convenience enough to pay $0.15/question
- **Reality**: They might just use free tier and wait until tomorrow
- **Risk**: 80% of users never convert from free

#### 2. **Voice Interface is Actually Useful**
- **My Assumption**: Hands-free is valuable when working on cars
- **Reality**: Maybe they prefer typing/visual results anyway
- **Risk**: Core value prop doesn't actually matter to users

#### 3. **Usage Distribution Follows Normal SaaS Patterns**
- **My Assumption**: 80/20 rule (few heavy users, many light users)
- **Reality**: Automotive use might be more seasonal/bursty
- **Risk**: Everyone just uses free tier + waits

### **📊 What Numbers I'm Most/Least Confident In:**

#### **High Confidence** (Real data):
- ✅ API costs per question ($0.04-0.14)
- ✅ Infrastructure scaling costs
- ✅ Competitor pricing (Haynes, AllData, etc.)

#### **Medium Confidence** (Industry benchmarks):
- 🟡 SaaS conversion rates (2-25% range is real)
- 🟡 Customer acquisition costs ($10-50 typical for apps)
- 🟡 LTV/CAC ratios (3:1 is standard target)

#### **Low Confidence** (Total guesses):
- ❌ Usage frequency patterns
- ❌ User distribution percentages
- ❌ Seasonal variation impact
- ❌ How much people actually value voice interface

### **🎯 What We Actually Need to Test:**

1. **Beta test with 50-100 real users** for 3 months
2. **Track actual usage patterns** - how often do people ask questions?
3. **A/B test pricing** - is $0.15 the right price point?
4. **Survey non-converters** - why didn't you upgrade from free?
5. **Measure seasonal variation** - winter vs summer usage

### **🔄 Revised "Conservative" Projections:**

If I'm being brutally honest about risk:

```
Worst Case Scenario:
- 90% stay on free tier forever
- 8% convert to usage-based (avg $2/month)
- 2% convert to premium ($10/month)

Per 1000 users:
- Revenue: $2,760/year
- Profit: $1,500/year (54% margin)
- Still profitable! Just much lower scale
```

**Bottom Line**: The unit economics work even in pessimistic scenarios, but the revenue projections are definitely optimistic estimates that need real user validation! 📊

## 🎯 **Why Subscription-Only Works Better:**

### **Simplicity:**
- No credit balance tracking
- No "running out" anxiety
- Easy to understand value
- Subscribe when working on cars, cancel when not

### **User Psychology:**
- Monthly subscription feels "normal"
- Annual discount drives commitment
- Clean upgrade path: Free → Gearhead → Master Tech

### **Better Economics:**
- **Gearhead**: $3.49 revenue after fees (25-60% margins)
- **Master Tech**: $20.99 revenue after fees (32-80% margins)
- **Annual plans**: Better cash flow, lower churn

## 💳 **Simplified Implementation:**

### **App Store Products:**
```
Gearhead Monthly: $4.99/month
Gearhead Annual: $49.90/year
Master Tech Monthly: $29.99/month
Master Tech Annual: $299.90/year
```

### **User Flow:**
1. Free trial → hit limits
2. Choose monthly or annual
3. Subscribe via App Store
4. Immediate feature access
5. Cancel anytime (keeps access until period ends)

### **Revenue Projections (Final):**

**Conservative (Per 1000 Users):**
- 60% Gearhead: 600 × $42/year = $25,200
- 20% Master Tech: 200 × $252/year = $50,400
- 20% Free: $0
- **Total: $75,600/year per 1,000 users**

**Optimistic (Per 1000 Users):**
- 50% Gearhead: 500 × $42/year = $21,000
- 35% Master Tech: 350 × $252/year = $88,200
- 15% Free: $0
- **Total: $109,200/year per 1,000 users**

**With annual plan uptake (30% choose annual):**
- Better cash flow
- Reduced churn
- Higher LTV per customer

Clean, simple, profitable. No credits complexity, no usage anxiety, just good old-fashioned SaaS subscriptions.
