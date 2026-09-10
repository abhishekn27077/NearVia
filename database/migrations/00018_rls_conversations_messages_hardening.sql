-- ==============================================================================
-- NEARVIA Migration: 00018_rls_conversations_messages_hardening.sql
-- Harden Row Level Security (RLS) policies for conversations and messages.
-- Replaces open policies (USING TRUE) with counterparty-restricted policies.
-- ==============================================================================

-- 1. Enable RLS (idempotent)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop old permissive policies
DROP POLICY IF EXISTS "Allow authenticated read on conversations" ON conversations;
DROP POLICY IF EXISTS "Allow authenticated insert/update on conversations" ON conversations;
DROP POLICY IF EXISTS "Allow authenticated read on messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated insert on messages" ON messages;
DROP POLICY IF EXISTS "Allow authenticated update on messages" ON messages;

DROP POLICY IF EXISTS "Allow participants to read conversations" ON conversations;
DROP POLICY IF EXISTS "Allow participants to modify conversations" ON conversations;
DROP POLICY IF EXISTS "Allow sender and recipient to read messages" ON messages;
DROP POLICY IF EXISTS "Allow sender to insert messages" ON messages;
DROP POLICY IF EXISTS "Allow recipient to update read status on messages" ON messages;

-- 3. Conversations Policies
-- A user can only view conversations where they are the assigned worker or provider
CREATE POLICY "Allow participants to read conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worker_profiles wp 
      JOIN users u ON wp.user_id = u.id
      WHERE wp.id = conversations.worker_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
    OR
    EXISTS (
      SELECT 1 FROM provider_profiles pp 
      JOIN users u ON pp.user_id = u.id
      WHERE pp.id = conversations.provider_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
  );

CREATE POLICY "Allow participants to modify conversations"
  ON conversations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM worker_profiles wp 
      JOIN users u ON wp.user_id = u.id
      WHERE wp.id = conversations.worker_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
    OR
    EXISTS (
      SELECT 1 FROM provider_profiles pp 
      JOIN users u ON pp.user_id = u.id
      WHERE pp.id = conversations.provider_id 
        AND (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text)
    )
  );

-- 4. Messages Policies
-- A user can only view messages where they are the sender or recipient
CREATE POLICY "Allow sender and recipient to read messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text) 
        AND (u.id = messages.sender_id OR u.id = messages.recipient_id)
    )
  );

-- A user can only send messages as themselves
CREATE POLICY "Allow sender to insert messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text) 
        AND u.id = messages.sender_id
    )
  );

-- A recipient can update message state (e.g. mark read_at)
CREATE POLICY "Allow recipient to update read status on messages"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE (u.auth_id = auth.uid()::text OR u.id::text = auth.uid()::text) 
        AND u.id = messages.recipient_id
    )
  );
