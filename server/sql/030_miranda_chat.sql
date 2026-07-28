-- Miranda live chat threads (www widget + admin handoff)

CREATE TABLE IF NOT EXISTS miranda_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'bot'
    CHECK (status IN ('bot', 'awaiting_ryan', 'live', 'closed')),
  title TEXT NOT NULL DEFAULT 'New conversation',
  visitor_name TEXT,
  visitor_email TEXT,
  requested_live_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miranda_chat_threads_status
  ON miranda_chat_threads (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_miranda_chat_threads_visitor
  ON miranda_chat_threads (visitor_token, updated_at DESC);

CREATE TABLE IF NOT EXISTS miranda_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES miranda_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'miranda', 'ryan', 'system')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miranda_chat_messages_thread
  ON miranda_chat_messages (thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS miranda_chat_notifications (
  id BIGSERIAL PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES miranda_chat_threads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'call', 'email')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  provider_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miranda_chat_notifications_thread
  ON miranda_chat_notifications (thread_id, created_at DESC);
