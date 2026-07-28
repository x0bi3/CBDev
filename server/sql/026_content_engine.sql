-- Content Engine: SEO page assets (service × industry × location)

CREATE TABLE IF NOT EXISTS seo_taxonomies (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'industry', 'location')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, slug)
);

CREATE TABLE IF NOT EXISTS seo_pages (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL UNIQUE,
  page_type TEXT NOT NULL DEFAULT 'service_industry_location'
    CHECK (page_type IN ('service_industry_location', 'service_location', 'custom')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'published')),
  service_id INTEGER REFERENCES seo_taxonomies(id) ON DELETE SET NULL,
  industry_id INTEGER REFERENCES seo_taxonomies(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES seo_taxonomies(id) ON DELETE SET NULL,
  h1 TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  canonical TEXT NOT NULL DEFAULT '',
  robots TEXT NOT NULL DEFAULT 'index,follow',
  og_image_url TEXT NOT NULL DEFAULT '',
  schema_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  publish_flags JSONB NOT NULL DEFAULT '{"sitemap":true,"indexnow":false,"gsc":false}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seo_pages_status_idx ON seo_pages (status);
CREATE INDEX IF NOT EXISTS seo_pages_service_idx ON seo_pages (service_id);
CREATE INDEX IF NOT EXISTS seo_pages_industry_idx ON seo_pages (industry_id);
CREATE INDEX IF NOT EXISTS seo_pages_location_idx ON seo_pages (location_id);

CREATE TABLE IF NOT EXISTS seo_page_sections (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES seo_pages(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  section_type TEXT NOT NULL DEFAULT 'body',
  heading TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seo_page_sections_page_idx ON seo_page_sections (page_id, sort_order);

CREATE TABLE IF NOT EXISTS seo_page_links (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES seo_pages(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  target_url TEXT,
  target_page_id INTEGER REFERENCES seo_pages(id) ON DELETE SET NULL,
  rel TEXT NOT NULL DEFAULT 'related',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seo_page_links_page_idx ON seo_page_links (page_id, sort_order);

-- Starter taxonomies (idempotent)
INSERT INTO seo_taxonomies (kind, slug, name, sort_order) VALUES
  ('service', 'websites', 'Websites', 10),
  ('service', 'software', 'Custom Software', 20),
  ('service', 'web-apps', 'Web Apps', 30),
  ('service', 'mobile-apps', 'Mobile Apps', 40),
  ('service', 'automations', 'Automations', 50),
  ('service', 'stores', 'Online Stores', 60),
  ('service', 'dashboards', 'Dashboards', 70),
  ('service', 'maintenance', 'Maintenance', 80),
  ('service', 'consulting', 'Consulting', 90),
  ('industry', 'hvac', 'HVAC', 10),
  ('industry', 'roofing', 'Roofing', 20),
  ('industry', 'remodeling', 'Remodeling', 30),
  ('industry', 'emergency', 'Emergency Services', 40),
  ('industry', 'restaurants', 'Restaurants', 50),
  ('industry', 'retail', 'Retail', 60),
  ('location', 'la-crosse', 'La Crosse', 10),
  ('location', 'madison', 'Madison', 20),
  ('location', 'milwaukee', 'Milwaukee', 30),
  ('location', 'wisconsin-dells', 'Wisconsin Dells', 40),
  ('location', 'onalaska', 'Onalaska', 50),
  ('location', 'holmen', 'Holmen', 60)
ON CONFLICT (kind, slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, active = TRUE;
