-- Service Center listing details (description, pricing, features, credits)
ALTER TABLE home_apps
  ADD COLUMN IF NOT EXISTS store_description TEXT,
  ADD COLUMN IF NOT EXISTS store_pricing TEXT,
  ADD COLUMN IF NOT EXISTS store_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS store_credits TEXT;

UPDATE home_apps SET
  store_description = 'Your personal AI assistant with tool access. Chat, plan, and automate tasks from one place.',
  store_pricing = 'Included with your account',
  store_features = '["Natural-language chat","MCP tool integrations","Session history","Full-screen workspace at /chat"]'::jsonb,
  store_credits = 'Built by Ryan Baldwin · CreativeBuilds'
WHERE app_id = 'chat' AND (store_description IS NULL OR store_description = '');
