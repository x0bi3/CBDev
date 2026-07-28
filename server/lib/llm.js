/**
 * OpenAI chat-completions helper for Content Engine / writing agents.
 * Reads OPENAI_API_KEY from process.env. Callers may override model (e.g. gpt-5.6-sol).
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

  const body = {
    model: resolvedModel,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
  };
  // Reasoning models may ignore temperature; still send when caller asks for creative variance.
  if (typeof temperature === 'number') {
    body.temperature = temperature;
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    // Some frontier models reject temperature — retry once without it.
    if (
      typeof temperature === 'number' &&
      /temperature|unsupported_value|invalid_request/i.test(errBody) &&
      res.status === 400
    ) {
      delete body.temperature;
      const retry = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!retry.ok) {
        const retryBody = await retry.text().catch(() => '');
        throw new Error(`OpenAI API ${retry.status}: ${retryBody.slice(0, 500)}`);
      }
      const retryData = await retry.json();
      const retryContent = retryData.choices?.[0]?.message?.content;
      if (!retryContent) throw new Error('OpenAI returned empty content');
      try {
        return JSON.parse(retryContent);
      } catch {
        throw new Error(`OpenAI returned invalid JSON: ${retryContent.slice(0, 200)}`);
      }
    }
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
