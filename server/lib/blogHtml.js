const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'br',
]);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert legacy JSON body array to HTML */
export function blocksToHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  return blocks.map((block) => {
    const s = String(block || '').trim();
    if (!s) return '';
    if (s.startsWith('### ')) return `<h3>${escapeHtml(s.slice(4))}</h3>`;
    if (s.startsWith('## ')) return `<h2>${escapeHtml(s.slice(3))}</h2>`;
    if (s.startsWith('# ')) return `<h2>${escapeHtml(s.slice(2))}</h2>`;
    return `<p>${escapeHtml(s)}</p>`;
  }).filter(Boolean).join('\n');
}

/** Strip disallowed tags/attributes from HTML */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (match.startsWith('</')) return `</${t}>`;
    if (t === 'a') {
      const href = match.match(/href="([^"]*)"/i)?.[1] || match.match(/href='([^']*)'/i)?.[1] || '';
      if (href && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return '<a>';
      return href ? `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">` : '<a>';
    }
    return `<${t}>`;
  });

  return out.trim();
}

/** Resolve body_html with legacy body fallback */
export function resolveBodyHtml(row) {
  if (row.body_html && String(row.body_html).trim()) {
    return row.body_html;
  }
  return blocksToHtml(row.body);
}
