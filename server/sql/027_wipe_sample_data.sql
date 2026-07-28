-- One-shot sample data wipe (safe for production after review).
-- Keeps real inquiries, real subscribers, real bookings/orders, non-demo quotes.

-- Sample blog CMS content
DELETE FROM blog_ideas WHERE TRUE;
DELETE FROM blog_agent_run_logs WHERE TRUE;
DELETE FROM blog_agent_runs WHERE TRUE;
DELETE FROM blog_agents WHERE TRUE;
DELETE FROM blog_posts WHERE TRUE;

-- Recon pipeline retired
DELETE FROM recon_reports WHERE TRUE;

-- Seed sample ticket(s)
DELETE FROM ticket_messages WHERE ticket_id IN (
  SELECT id FROM support_tickets WHERE subject ILIKE 'Sample:%' OR email = 'demo@creativebuilds.dev'
);
DELETE FROM support_tickets WHERE subject ILIKE 'Sample:%' OR email = 'demo@creativebuilds.dev';

-- Obviously-fake / demo quotes (adjust if needed before running)
DELETE FROM quotes WHERE
  client_email ILIKE '%@example.com'
  OR client_email ILIKE '%demo%'
  OR client_email = 'test@email.com'
  OR (status = 'draft' AND COALESCE(client_name, '') ILIKE '%test%');

-- Optional: seed merch / portfolio placeholders (commented — enable only if you want a clean slate)
-- DELETE FROM merch_order_items WHERE TRUE;
-- DELETE FROM merch_orders WHERE TRUE;
-- DELETE FROM products WHERE TRUE;
-- DELETE FROM portfolio_projects WHERE TRUE;
