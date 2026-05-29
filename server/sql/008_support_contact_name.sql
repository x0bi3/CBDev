ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS contact_name TEXT;
