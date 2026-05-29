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

INSERT INTO blog_posts (slug, title, excerpt, body, read_time, status, published_at) VALUES
  ('shipping-lighthouse-100-react', 'Shipping a Lighthouse-100 React app in 2025',
   'A field guide to the boring wins that compound: bundle splitting, image strategy, and the unsexy CDN settings that move the needle.',
   '["Performance work isn''t a single hero pull-request. It''s a hundred small decisions made consistently across a codebase, and the discipline to revisit them every release.","In this post we walk through the audit we run on every project: opening DevTools, recording a 6× CPU throttled trace, identifying the long tasks, and breaking them apart with route-level code splitting.","We''ll also cover the often-overlooked CDN settings (stale-while-revalidate, immutable assets, brotli compression) that make repeat visits feel instant.","Finally: how to wire all of this into CI so regressions never reach production."]'::jsonb,
   '8 min', 'published', '2025-11-04T12:00:00Z'),
  ('glsl-for-designers', 'GLSL for designers: a gentle on-ramp',
   'You don''t need a CS degree to write your first fragment shader. Start with color, then noise, then displacement.',
   '["Shaders are intimidating because the syntax is unfamiliar and the feedback loop feels alien. There is no console.log, just pixels.","But fragment shaders are really just a function: for every pixel on screen, return a color. Once you internalize that, the rest is just math.","We start with constants, move to UVs, then introduce time. By the end of part one you''ll have a gradient that pulses."]'::jsonb,
   '12 min', 'published', '2025-10-18T12:00:00Z'),
  ('choreographing-scroll-gsap-lenis', 'Choreographing scroll with GSAP & Lenis',
   'Smooth scroll gets a bad rap. Done well, it''s the difference between a website and an experience.',
   '["Smooth scroll has earned its reputation. Most implementations fight the browser, break find-on-page, and add jank on low-end devices.","Lenis sidesteps most of these issues by piggy-backing on the native scroll position. Combined with GSAP ScrollTrigger, you get buttery transitions without fighting the platform."]'::jsonb,
   '6 min', 'published', '2025-09-27T12:00:00Z'),
  ('design-tokens-that-scale', 'Design tokens that actually scale',
   'Most token systems collapse under their own weight. Here''s how to design one that survives three product redesigns.',
   '["The first token system you build is almost always too granular. The second is too coarse. The third one, finally, fits.","In this post we share the three-tier token taxonomy we''ve standardised on: primitives, semantic, and component."]'::jsonb,
   '9 min', 'published', '2025-08-12T12:00:00Z');

INSERT INTO support_tickets (user_id, email, subject, category, priority, status, client_id, contact_pref, contact_email) VALUES
  (1, 'demo@creativebuilds.dev', 'Sample: deployment pipeline question', 'Technical', 'Normal', 'open', 'CB-04821', 'Email', 'demo@creativebuilds.dev');

INSERT INTO ticket_messages (ticket_id, sender, body) VALUES
  (1, 'user', 'Hi — I need help wiring our staging deploy to run after PR merge. Can you point me at the right docs?'),
  (1, 'staff', 'Thanks for reaching out! We''ll review your pipeline config and follow up within 24 hours with next steps.');
