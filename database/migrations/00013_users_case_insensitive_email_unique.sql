-- ==============================================================================
-- Migration: 00013_users_case_insensitive_email_unique.sql
-- Purpose: Enforce case-insensitive email uniqueness on public.users
-- Prevents duplicate account creation via casing variations or concurrent race conditions
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower 
ON public.users (LOWER(email)) 
WHERE email IS NOT NULL;
