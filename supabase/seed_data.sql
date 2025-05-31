-- Seed Data for GreaseMonkey AI Feedback System
-- This file contains sample data for testing and reference

-- Sample Bug Report Categories (for reference - these are hardcoded in the Flutter app)
/*
Bug Report Categories:
- Voice Recognition Issues
- Wrong or Bad Answers
- App Crashes or Freezes
- Audio Problems
- Vehicle Info Not Saving
- Login/Account Issues
- Performance Issues
- Other
*/

-- Sample Feature Request Categories (for reference - these are hardcoded in the Flutter app)
/*
Feature Request Categories:
- Voice Recognition Improvements
- New Vehicle/Engine Support
- Better Diagnostic Tools
- Tool Recommendations
- Parts Information
- Repair Procedures
- Video/Visual Guides
- Integration with Other Apps
- Offline Features
- User Interface Improvements
- Other
*/

-- Sample Bug Report Severities
/*
Severity Levels:
- Low - Minor annoyance
- Medium - Affects my work
- High - Can't use the app
- Critical - App is broken
*/

-- Sample Feature Request Priorities
/*
Priority Levels:
- Nice to Have
- Would Help My Work
- Really Need This
- Game Changer for My Shop
*/

-- Sample Bug Report Statuses
/*
Bug Statuses:
- open (default)
- in_progress
- resolved
- closed
*/

-- Sample Feature Request Statuses
/*
Feature Request Statuses:
- submitted (default)
- planned
- in_progress
- completed
- rejected
*/

-- Test data (uncomment if you want to insert sample data for testing)
/*
-- Insert a test user (you would normally create this through Supabase Auth)
INSERT INTO public.users (user_id, email, tier) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'test.mechanic@example.com', 'free')
ON CONFLICT (user_id) DO NOTHING;

-- Sample bug reports
INSERT INTO public.bug_reports (user_id, title, description, category, severity, steps_to_reproduce) VALUES
(
    '550e8400-e29b-41d4-a716-446655440000',
    'App crashes when asking about brakes',
    'Every time I ask about brake pad replacement, the app just closes',
    'App Crashes or Freezes',
    'High - Can''t use the app',
    ARRAY['Say "Hey GreaseMonkey"', 'Ask "How do I replace brake pads on a 2015 Honda Civic"', 'App crashes immediately']
),
(
    '550e8400-e29b-41d4-a716-446655440000',
    'Voice recognition doesn''t understand me',
    'The app has trouble understanding my voice, especially with car model names',
    'Voice Recognition Issues',
    'Medium - Affects my work',
    ARRAY['Try to say car model names', 'App shows wrong text', 'Have to type everything manually']
);

-- Sample feature requests
INSERT INTO public.feature_requests (user_id, title, description, category, priority, use_case) VALUES
(
    '550e8400-e29b-41d4-a716-446655440000',
    'Add tool recommendations',
    'When the app tells me how to fix something, it should also tell me what tools I need',
    'Tool Recommendations',
    'Really Need This',
    'When I''m working on a car and the app gives me repair instructions, I want to know what tools to get before I start'
),
(
    '550e8400-e29b-41d4-a716-446655440000',
    'Support for older cars',
    'The app doesn''t seem to know much about cars from the 1990s and earlier',
    'New Vehicle/Engine Support',
    'Would Help My Work',
    'I work on a lot of classic cars and older vehicles that customers bring in'
);

-- Add some votes to the feature requests
INSERT INTO public.feature_votes (user_id, feature_request_id)
SELECT '550e8400-e29b-41d4-a716-446655440000', id
FROM public.feature_requests
WHERE title = 'Add tool recommendations';
*/
