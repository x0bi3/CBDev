-- Update lead-gen blog agent configs with dynamic discovery defaults
UPDATE blog_agents SET config = '{
  "allowed_tags": ["react", "nextjs", "nodejs", "tailwind", "supabase", "postgres", "stripe"],
  "maxItems": 5,
  "autoPublish": false,
  "useSeedFallback": false,
  "minScore": 5,
  "redditSorts": ["hot", "top", "new"],
  "subreddits": ["saas", "sideproject", "smallbusiness", "entrepreneur", "startups"],
  "hnQueries": ["SaaS pricing expensive", "Zapier alternative", "HubSpot pricing"]
}'::jsonb
WHERE slug = 'saas-bill-hunter';

UPDATE blog_agents SET config = '{
  "allowed_tags": ["docker", "nodejs", "postgres", "coolify", "caprover", "nginx"],
  "maxItems": 5,
  "autoPublish": false,
  "useSeedFallback": false,
  "repos": [
    "pocketbase/pocketbase",
    "coolifyio/coolify",
    "caprover/caprover",
    "umami-software/umami",
    "n8n-io/n8n",
    "plausible/analytics",
    "appwrite/appwrite"
  ]
}'::jsonb
WHERE slug = 'self-hosted-champion';

UPDATE blog_agents SET config = '{
  "allowed_tags": ["nextjs", "nodejs", "stripe", "postgres", "supabase"],
  "maxItems": 5,
  "autoPublish": false,
  "useSeedFallback": false,
  "feedUrls": [
    "https://stripe.com/blog/feed.rss",
    "https://stripe.com/docs/changelog.rss"
  ],
  "hnQueries": ["Stripe billing", "Stripe webhooks", "micro SaaS payments"]
}'::jsonb
WHERE slug = 'monetization-blueprint';
