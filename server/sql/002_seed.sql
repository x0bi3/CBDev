-- Seed data (mirrors standalone-main.jsx hardcoded content)
-- Demo user password: demo1234

INSERT INTO users (email, name, password_hash, role) VALUES
  ('demo@creativebuilds.dev', 'Demo User', '$2a$10$uVcaGL0Ansav.g/vnbQcg.4rf6yzkWsrd0wXdVAkfsq1RhbtaPu3q', 'user');

INSERT INTO product_categories (slug, label, icon, sort_order) VALUES
  ('all', 'All', '✨', 0),
  ('apparel', 'Apparel', '👕', 1),
  ('drink', 'Drinkware', '☕', 2),
  ('sticker', 'Stickers', '🌟', 3),
  ('tech', 'Tech', '⌨️', 4);

INSERT INTO products (slug, name, category_slug, price_cents, description, color, images, variants, sort_order) VALUES
  ('hoodie-ship-it', 'Hoodie · "Ship It"', 'apparel', 4800,
   'Heavyweight 380gsm fleece, brushed interior, embroidered chest mark. Built for late-night release pushes and weekend deploys.',
   'from-rose-500 to-red-800',
   '["from-rose-500 to-red-800","from-rose-400 to-pink-700","from-red-700 to-rose-900"]'::jsonb,
   '{"Size":["XS","S","M","L","XL","XXL"],"Color":["Crimson","Ink","Stone"]}'::jsonb, 1),
  ('tee-console-log', 'Tee · "console.log"', 'apparel', 2200,
   '180gsm combed cotton with a soft hand-feel. Screen-printed in the UK with water-based inks.',
   'from-sky-400 to-blue-800',
   '["from-sky-400 to-blue-800","from-cyan-400 to-blue-700","from-sky-500 to-indigo-800"]'::jsonb,
   '{"Size":["XS","S","M","L","XL"],"Color":["Sky","Black","Cream"]}'::jsonb, 2),
  ('mug-404', 'Mug · "404"', 'drink', 1400,
   '350ml ceramic mug. Dishwasher-safe wraparound print. Microwave-safe up to two reheats of cold coffee.',
   'from-amber-400 to-orange-700',
   '["from-amber-400 to-orange-700","from-yellow-400 to-amber-600","from-orange-500 to-red-700"]'::jsonb,
   '{"Style":["Matte","Gloss"]}'::jsonb, 3),
  ('sticker-pack', 'Sticker pack', 'sticker', 600,
   'Ten weather-proof vinyl stickers. Perfect for laptops, water bottles, or any flat surface that needs more personality.',
   'from-emerald-400 to-teal-800',
   '["from-emerald-400 to-teal-800","from-green-400 to-emerald-700","from-teal-400 to-cyan-700"]'::jsonb,
   '{}'::jsonb, 4),
  ('cap-embroidered', 'Cap · Embroidered', 'apparel', 2800,
   'Six-panel structured cap with low-profile embroidered logo and adjustable buckle strap.',
   'from-indigo-500 to-violet-900',
   '["from-indigo-500 to-violet-900","from-blue-500 to-indigo-800","from-violet-500 to-purple-900"]'::jsonb,
   '{"Color":["Ink","Stone","Olive"]}'::jsonb, 5),
  ('keycap-set', 'Keycap set', 'tech', 4200,
   'PBT double-shot keycaps in the CreativeBuilds colorway. Cherry profile, 141 keys, compatible with most mechanical keyboards.',
   'from-fuchsia-500 to-purple-800',
   '["from-fuchsia-500 to-purple-800","from-pink-500 to-fuchsia-700","from-purple-500 to-fuchsia-800"]'::jsonb,
   '{"Profile":["Cherry","OEM"]}'::jsonb, 6),
  ('bottle-insulated', 'Bottle · Insulated', 'drink', 2400,
   '500ml double-walled stainless steel. Keeps cold drinks cold for 24 hours, hot drinks hot for 12.',
   'from-cyan-400 to-blue-700',
   '["from-cyan-400 to-blue-700","from-sky-400 to-cyan-700","from-blue-400 to-sky-700"]'::jsonb,
   '{"Color":["Steel","Black","White"]}'::jsonb, 7),
  ('holographic-stickers', 'Holographic stickers', 'sticker', 900,
   'Five iridescent vinyl stickers that catch the light differently from every angle.',
   'from-pink-400 to-purple-700',
   '["from-pink-400 to-purple-700","from-fuchsia-400 to-pink-700","from-rose-400 to-fuchsia-700"]'::jsonb,
   '{}'::jsonb, 8);

INSERT INTO portfolio_projects (slug, name, tag, color, role, year, stack, summary, highlights, sort_order) VALUES
  ('project-a', 'Project A: Orbital Bank', 'Fintech · 2024', 'from-indigo-500 to-fuchsia-600',
   'Lead Frontend', '2024', 'Next · R3F · GSAP',
   'A bold marketing experience that pairs an interactive 3D hero with a scroll-driven product reveal.',
   '["96 Lighthouse · 1.1s LCP","Custom GLSL refractive material","38% lift in conversion vs. previous site"]'::jsonb, 1),
  ('project-b', 'Project B: Nimbus CMS', 'SaaS · 2023', 'from-emerald-400 to-cyan-700',
   'Tech Lead', '2023', 'Next · tRPC · Postgres',
   'A multi-tenant headless CMS with a drag-and-drop block editor and edge-rendered preview.',
   '["12K+ active workspaces","Block editor with 40+ types","Sub-200ms preview on the edge"]'::jsonb, 2),
  ('project-c', 'Project C: Atlas Travel', 'WebGL · 2023', 'from-amber-400 to-rose-600',
   'Creative Engineer', '2023', 'three.js · GSAP · Lenis',
   'An immersive travel storytelling platform with a 3D world map and cinematic destination guides.',
   '["Custom globe shader","220K monthly active users","Featured in Awwwards SOTD"]'::jsonb, 3),
  ('project-d', 'Helix Studio', 'Agency · 2022', 'from-violet-500 to-purple-900',
   'Frontend Lead', '2022', 'Vite · GSAP · Three.js',
   'A boutique creative agency site with kinetic typography and a magnetic cursor.',
   '["Awwwards Honourable Mention","100/100 Lighthouse","Bespoke shader gallery"]'::jsonb, 4);

-- Blog seed removed (Content Engine replaces SEO content). blog_posts table may remain empty.

-- Sample support ticket removed — use wipe script 027 for leftover demos.
