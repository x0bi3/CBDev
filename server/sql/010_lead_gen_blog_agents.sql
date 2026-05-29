-- Lead-gen SEO blog agents: SaaS Bill Hunter, Self-Hosted Champion, Monetization Blueprint
INSERT INTO blog_agents (slug, name, description, script_module, enabled, schedule_interval_minutes, config)
VALUES
  (
    'saas-bill-hunter',
    'SaaS Bill Hunter',
    'Scans Reddit for SaaS pricing pain points and drafts custom VPS alternative articles.',
    'saas-bill-hunter',
    FALSE,
    1440,
    '{
      "allowed_tags": ["react", "nextjs", "nodejs", "tailwind", "supabase", "postgres", "stripe"],
      "maxItems": 5,
      "autoPublish": false,
      "subreddits": ["saas", "sideproject", "smallbusiness"]
    }'::jsonb
  ),
  (
    'self-hosted-champion',
    'Self-Hosted Champion',
    'Tracks open-source release feeds and drafts VPS deployment highlight posts.',
    'self-hosted-champion',
    FALSE,
    1440,
    '{
      "allowed_tags": ["docker", "nodejs", "postgres", "coolify", "caprover", "nginx"],
      "maxItems": 5,
      "autoPublish": false,
      "repos": [
        "awesome-selfhosted/awesome-selfhosted",
        "pocketbase/pocketbase",
        "coolifyio/coolify",
        "caprover/caprover",
        "umami-software/umami",
        "n8n-io/n8n"
      ]
    }'::jsonb
  ),
  (
    'monetization-blueprint',
    'Monetization Blueprint',
    'Monitors Stripe billing updates and drafts MVP payment integration tutorials.',
    'monetization-blueprint',
    FALSE,
    1440,
    '{
      "allowed_tags": ["nextjs", "nodejs", "stripe", "postgres", "supabase"],
      "maxItems": 5,
      "autoPublish": false,
      "feedUrls": [
        "https://stripe.com/blog/feed.rss",
        "https://stripe.com/newsroom/news/feed"
      ]
    }'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
