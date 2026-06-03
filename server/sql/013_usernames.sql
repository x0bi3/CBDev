-- Add unique usernames for CreativeBuilds accounts (login via email or username)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE users SET username = 'demo' WHERE email = 'demo@creativebuilds.dev' AND username IS NULL;
UPDATE users SET username = 'test' WHERE email = 'test@email.com' AND username IS NULL;
UPDATE users SET username = 'admin' WHERE email = 'admin@creativebuilds.dev' AND username IS NULL;
UPDATE users SET username = 'x0bi3' WHERE email = 'x0bi3@creativebuilds.dev' AND username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));
