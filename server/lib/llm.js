/**
 * OpenAI chat-completions helper for blog agents.
 * Reads OPENAI_API_KEY and OPENAI_MODEL from process.env (loaded via server/.env).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * @param {{ system: string, user: string, schemaHint?: string, model?: string, temperature?: number }} opts
 * @returns {Promise<Record<string, unknown>>}
 */
export async function generateJSON({ system, user, schemaHint, model, temperature = 0.4 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY missing — add it to server/.env');
  }

  const resolvedModel = model || process.env.OPENAI_MODEL || 'gpt-4o';
  const userContent = schemaHint
    ? `${user}\n\nRespond with valid JSON matching this shape:\n${schemaHint}`
    : user;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${content.slice(0, 200)}`);
  }
}
