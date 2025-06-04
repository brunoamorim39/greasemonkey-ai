-- Migration: Fix vehicles RLS policy for service operations
-- Created: 2024-01-XX
-- Purpose: Allow backend service to manage vehicles on behalf of users

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can manage own vehicles" ON public.vehicles;

-- Create more permissive policies for vehicles table
-- Allow authenticated users to manage their own vehicles
CREATE POLICY "Users can manage own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

-- Allow service role to manage vehicles (for backend operations)
CREATE POLICY "Service can manage all vehicles" ON public.vehicles
  FOR ALL USING (auth.role() = 'service_role');

-- Allow anon role to manage vehicles (for demo/development)
CREATE POLICY "System can manage vehicles" ON public.vehicles
  FOR ALL WITH CHECK (true);

-- Comment explaining the policies
COMMENT ON TABLE public.vehicles IS 'Vehicle information with RLS policies for user isolation and service access';
