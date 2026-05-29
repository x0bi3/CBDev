import { generateJSON } from './llm.js';
import { sanitizeHtml } from './blogHtml.js';
import { query } from '../db.js';

const BRAND_SYSTEM = `You are an expert blog writer for CreativeBuilds — a solo dev agency offering affordable web design, app development, custom software automation, and VPS-hosted solutions with Stripe merchant processing.

Voice: first-person plural builder ("We build...", "In our production environments...").
Rules:
- E-E-A-T: no dictionary fluff; include proof-of-work (code snippets, config blocks, terminal steps).
- H2/H3 structure; answer the reader's question in the first two sentences under each heading.
- Include relevant hyperlinks with real URLs when a source is provided; otherwise use descriptive anchor text.
- End with a contextual CTA mapping the article problem to CreativeBuilds services (flat setup fee, VPS hosting, custom automation — not generic ads).
- Output body_html as valid HTML using only: p, h2, h3, h4, ul, ol, li, a, strong, em, code, pre, blockquote.
- Code snippets go in <pre><code> blocks.`;

async function loadIdea(ideaId) {
  const { rows } = await query('SELECT * FROM blog_ideas WHERE id = $1', [ideaId]);
  return rows[0] || null;
}

/**
 * @param {{ action: string, prompt?: string, ideaId?: number, title?: string, excerpt?: string, body_html?: string, selection?: string }} opts
 */
export async function runBlogAssist(opts) {
  const action = opts.action || 'generate';

  if (action === 'generate') {
    let userPrompt = opts.prompt || '';
    let sourceUrl = '';

    if (opts.ideaId) {
      const idea = await loadIdea(opts.ideaId);
      if (idea) {
        userPrompt = `Write a full blog article about: ${idea.title}
Angle: ${idea.angle}
Rationale: ${idea.rationale}
Keywords: ${(idea.keywords || []).join(', ')}`;
        sourceUrl = idea.source_url || '';
      }
    }

    if (!userPrompt.trim()) {
      throw new Error('Prompt or idea required');
    }

    const schemaHint = `{
  "title": "string",
  "slug": "string — kebab-case",
  "excerpt": "string — 1-2 sentences",
  "read_time": "string e.g. 8 min",
  "body_html": "string — full article HTML"
}`;

    const result = await generateJSON({
      system: BRAND_SYSTEM,
      user: `Write a complete blog article.

Brief: ${userPrompt}
${sourceUrl ? `Source for E-E-A-T link in opening paragraph: ${sourceUrl}` : ''}

Include: intro with outbound link if source provided, structured H2/H3 sections, code/config examples where relevant, financial or practical comparison if applicable, closing CTA for CreativeBuilds services.`,
      schemaHint,
      temperature: 0.5,
    });

    return {
      title: result.title,
      slug: result.slug,
      excerpt: result.excerpt,
      read_time: result.read_time || '6 min',
      body_html: sanitizeHtml(result.body_html || ''),
    };
  }

  if (action === 'add_cta') {
    const schemaHint = `{ "body_html": "string — existing body with CTA paragraph appended" }`;
    const result = await generateJSON({
      system: BRAND_SYSTEM,
      user: `Append a contextual closing CTA paragraph to this article HTML. Map the article topic to CreativeBuilds services (VPS hosting, custom automation, flat setup fee).

Title: ${opts.title || ''}
Current HTML:\n${opts.body_html || ''}`,
      schemaHint,
      temperature: 0.4,
    });
    return { body_html: sanitizeHtml(result.body_html || opts.body_html || '') };
  }

  if (action === 'expand') {
    const schemaHint = `{ "body_html": "string — expanded article HTML" }`;
    const result = await generateJSON({
      system: BRAND_SYSTEM,
      user: `Expand this draft with more technical depth, code examples, and E-E-A-T proof-of-work.

Title: ${opts.title || ''}
Brief: ${opts.prompt || ''}
Current HTML:\n${opts.body_html || ''}`,
      schemaHint,
      temperature: 0.5,
    });
    return { body_html: sanitizeHtml(result.body_html || opts.body_html || '') };
  }

  if (action === 'rewrite_selection') {
    const schemaHint = `{ "html": "string — rewritten selection as HTML fragment" }`;
    const result = await generateJSON({
      system: BRAND_SYSTEM,
      user: `Rewrite this selection for clarity and SEO while keeping CreativeBuilds builder voice:\n${opts.selection || ''}`,
      schemaHint,
      temperature: 0.4,
    });
    return { html: sanitizeHtml(result.html || opts.selection || '') };
  }

  throw new Error(`Unknown assist action: ${action}`);
}
