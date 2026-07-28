/**
 * Miranda chat — persisted threads, live handoff to Ryan, Intro Call booking tools.
 */
import { Router } from 'express';
import { URLS } from '../lib/urls.js';
import { listIntroSlots } from '../lib/calSlots.js';
import { createIntroBooking } from '../lib/cal.js';
import {
  OPENING_TEXT,
  createThread,
  getThreadById,
  getThreadForVisitor,
  insertMessage,
  listMessages,
  listAllMessages,
  requestLiveChat,
  titleFromFirstMessage,
  setVisitorInfo,
  uiRoleFromDb,
  updateThreadTitle,
} from '../lib/mirandaChat.js';
import { notifyRyanLiveChat, notifyRyanEscalation } from '../lib/notifyRyan.js';

const router = Router();

const SYSTEM = `You are Miranda, Ryan's virtual assistant for CreativeBuilds (Wisconsin). Ryan Baldwin is the accountable founder; specialized agents help (Ryker recon before design, Freddy design, Eddy engineering, Cody writing, Quinn QA).

Voice: warm, concise, Wisconsin-honest. Use "we" for the studio. Never invent fixed project quotes. Never collect payment card data.
Identity: If you need to disclose what you are, say "virtual assistant" — never call yourself an A.I., an artificial intelligence, or a bot.

Public CTAs:
- Pricing: ${URLS.www}/pricing
- Scope a project: ${URLS.www}/inquiry
- Free Service Audits: ${URLS.www}/service-audits
- Book page (embeds): ${URLS.www}/book
- Audits: ${URLS.www}/audit
- Early Bird: ${URLS.www}/earlybirdcampaign (first 5 website clients; do not recite Stripe promo codes)

Live chat with Ryan:
- If they want Ryan, a human, or live chat, call request_live_chat once you have their intent (name/email helpful but not required).
- Say you are checking if Ryan is available and will ping him — they can keep this window open.
- Do not promise instant response; Ryan joins from the admin panel when free.

Booking (chat can book the free Discovery / Intro Call):
- When they want to schedule a call/meeting/Discovery/Intro Call, call check_slots first, then collect full name, email, and a 10+ digit phone before book_intro_call.
- Offer 2–3 slot labels from the tool (Central Time). Confirm the chosen time, then pass the EXACT start ISO from check_slots — never invent a timestamp.
- You are NOT booked until book_intro_call returns ok:true. Never pretend a booking succeeded.
- Paid Blitz Call ($20) is website-only at ${URLS.www}/book — do not book Blitz here.
- If tools fail, link ${URLS.www}/book and offer to notify Ryan.

If they want a human or are urgent, offer live chat via request_live_chat or email hello@creativebuilds.dev. Keep replies short (2–5 sentences) unless listing times.`;

const FAQ = [
  {
    keys: ['price', 'pricing', 'cost', 'how much'],
    reply:
      'Pricing depends on scope — websites, apps, and automation are quoted individually. Browse https://www.creativebuilds.dev/pricing or take Free Service Audits and we will point you to the right next step.',
  },
  {
    keys: ['book', 'call', 'schedule', 'meeting', 'discovery'],
    reply:
      'I can book a free Discovery Call right here — share your name, email, phone, and a preferred time window, or open https://www.creativebuilds.dev/book.',
  },
  {
    keys: ['vibe', 'fit', 'audit', 'not sure', 'unsure'],
    reply:
      'If you are not ready for a full inquiry, Free Service Audits is perfect — a quick presence audit with concrete next steps: https://www.creativebuilds.dev/service-audits',
  },
  {
    keys: ['hosting', 'domain', 'dns', 'transfer'],
    reply:
      'We settle domain ownership before deposit — keep at your registrar, transfer, or we purchase. Scope a project and tell us which: https://www.creativebuilds.dev/inquiry',
  },
  {
    keys: ['hello', 'hi', 'hey', 'help'],
    reply: OPENING_TEXT,
  },
  {
    keys: ['team', 'agent', 'miranda', 'ryker', 'freddy'],
    reply:
      'Ryan runs CreativeBuilds with an agentic staff — recon, design, build, writing, and QA. Meet everyone at https://www.creativebuilds.dev/team',
  },
  {
    keys: ['ryan', 'human', 'live chat', 'real person', 'speak to'],
    reply:
      "I can check if Ryan is available for a live chat right here — want me to ping him? You can also email hello@creativebuilds.dev.",
  },
];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_slots',
      description: 'List open free Intro Call / Discovery Call slots on Ryan’s calendar (Central Time).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max slots to return (default 6, max 12)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_intro_call',
      description:
        'Book the free 30-minute Intro Call. Requires name, email, phone (10+ digits), and start ISO from check_slots.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          start: { type: 'string', description: 'ISO timestamp from check_slots' },
          notes: { type: 'string', description: 'Optional one-line project note' },
        },
        required: ['name', 'email', 'phone', 'start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_live_chat',
      description:
        'Ping Ryan for a live chat takeover. Use when visitor wants Ryan, a human, or live chat. Optional name/email.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
];

function matchFaq(text) {
  const lower = text.toLowerCase();
  for (const item of FAQ) {
    if (item.keys.some((k) => lower.includes(k))) return item.reply;
  }
  return null;
}

function extractEmail(text) {
  const m = String(text).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function looksLikePhone(value) {
  const digits = digitsOnly(value);
  return digits.length >= 10 && digits.length <= 15;
}

function normalizePhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return String(value || '').trim();
}

function wantsLiveChat(message) {
  return /live chat|talk to ryan|speak to ryan|get ryan|real person|human|available for (a )?chat/i.test(message);
}

async function runTool(name, args, ctx) {
  if (name === 'check_slots') {
    const limit = Math.min(Number(args?.limit) || 6, 12);
    const data = await listIntroSlots({ limit });
    return {
      ok: true,
      timeZone: data.timeZone,
      slots: (data.slots || []).map((s) => ({
        start: s.start,
        label: s.label,
        timeZone: s.timeZone,
      })),
    };
  }

  if (name === 'book_intro_call') {
    const nameVal = String(args?.name || '').trim();
    const email = String(args?.email || '').trim().toLowerCase();
    const phone = normalizePhone(args?.phone);
    const start = args?.start;
    if (!nameVal || !email || !start) {
      return { ok: false, error: 'name, email, and start are required' };
    }
    if (!looksLikePhone(phone)) {
      return { ok: false, error: 'phone must include at least 10 digits' };
    }
    const startMs = Date.parse(start);
    if (Number.isNaN(startMs) || startMs < Date.now() + 5 * 60 * 1000) {
      return {
        ok: false,
        error: 'start must be a future ISO timestamp from check_slots — call check_slots again',
      };
    }
    const open = await listIntroSlots({ limit: 30 });
    const allowed = new Set((open.slots || []).map((s) => s.start));
    if (!allowed.has(new Date(startMs).toISOString())) {
      return {
        ok: false,
        error: 'start is not an open slot. Call check_slots and use an exact start from the list.',
        slots: (open.slots || []).slice(0, 6).map((s) => ({ start: s.start, label: s.label })),
      };
    }
    const result = await createIntroBooking({
      name: nameVal,
      email,
      phone,
      startIso: new Date(startMs).toISOString(),
      notes: args?.notes,
      metadata: { source: 'miranda-chat', threadId: ctx?.threadId },
    });
    if (!result.ok) {
      return {
        ok: false,
        conflict: Boolean(result.conflict),
        error:
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Booking failed',
      };
    }
    return {
      ok: true,
      uid: result.uid,
      label: result.label,
      bookingUrl: result.bookingUrl,
      speak: `Booked: free Intro Call with Ryan on ${result.label} Central. Confirmation email to ${email}.`,
    };
  }

  if (name === 'request_live_chat') {
    if (!ctx?.threadId) return { ok: false, error: 'No thread' };
    const thread = await requestLiveChat(ctx.threadId, {
      name: args?.name || ctx?.name,
      email: args?.email || ctx?.email,
    });
    if (!thread) return { ok: false, error: 'Could not request live chat' };
    const messages = await listAllMessages(ctx.threadId);
    await notifyRyanLiveChat({
      threadId: ctx.threadId,
      thread,
      messages,
      reason: args?.reason || 'Visitor requested live chat',
      latestMessage: ctx?.latestMessage,
    });
    await insertMessage({
      threadId: ctx.threadId,
      role: 'system',
      body: 'Live chat requested — pinging Ryan now.',
    });
    return {
      ok: true,
      speak:
        "I am pinging Ryan now to see if he is available for a live chat. Keep this window open — he will join here when he is free.",
    };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}

async function openAiReply(message, history, ctx) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const messages = [
    { role: 'system', content: SYSTEM },
    ...history
      .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && h.text)
      .slice(-10)
      .map((h) => ({ role: h.role, content: String(h.text).slice(0, 1500) })),
    { role: 'user', content: message },
  ];

  let booking = null;
  let slots = null;
  let liveRequested = false;

  for (let round = 0; round < 4; round++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 500,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('chat: OpenAI', res.status, errBody.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) return null;

    const toolCalls = choice.tool_calls || [];
    if (!toolCalls.length) {
      return { reply: choice.content?.trim() || null, booking, slots, liveRequested };
    }

    messages.push({
      role: 'assistant',
      content: choice.content || null,
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      const fn = tc.function?.name;
      let args = {};
      try {
        args = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        args = {};
      }
      let result;
      try {
        result = await runTool(fn, args, { ...ctx, latestMessage: message });
      } catch (err) {
        console.error('chat: tool', fn, err);
        result = { ok: false, error: err.message || 'Tool failed' };
      }
      if (fn === 'check_slots' && result?.slots) slots = result.slots;
      if (fn === 'book_intro_call' && result?.ok) booking = result;
      if (fn === 'request_live_chat' && result?.ok) liveRequested = true;
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply:
      'I hit a snag finishing that — you can book directly at https://www.creativebuilds.dev/book, or ask me to ping Ryan for a live chat.',
    booking,
    slots,
    liveRequested,
  };
}

async function resolveThread(req) {
  const visitorToken = String(req.body.visitorToken || req.headers['x-visitor-token'] || '').trim();
  if (!visitorToken) {
    return { error: 'visitorToken required', status: 400 };
  }
  let threadId = req.body.threadId ? String(req.body.threadId).trim() : null;
  let thread = null;
  if (threadId) {
    thread = await getThreadForVisitor(threadId, visitorToken);
    if (!thread) return { error: 'Thread not found', status: 404 };
  } else {
    thread = await createThread({ visitorToken });
    threadId = thread.id;
  }
  return { thread, threadId, visitorToken };
}

function serializeMessages(rows) {
  return rows.map((m) => ({
    id: m.id,
    role: uiRoleFromDb(m.role),
    dbRole: m.role,
    text: m.body,
    createdAt: m.createdAt,
  }));
}

router.post('/', async (req, res) => {
  try {
    const message = String(req.body.message || '').trim().slice(0, 2000);
    const name = req.body.name ? String(req.body.name).trim().slice(0, 120) : '';
    const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];
    if (!message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    const resolved = await resolveThread(req);
    if (resolved.error) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const { thread, threadId, visitorToken } = resolved;

    const email = extractEmail(message) || (req.body.email ? String(req.body.email).toLowerCase() : null);
    if (name || email) await setVisitorInfo(threadId, { name: name || null, email });

    await insertMessage({ threadId, role: 'visitor', body: message });
    const title = titleFromFirstMessage(message);
    if (title !== 'New conversation') await updateThreadTitle(threadId, title);

    const fresh = await getThreadById(threadId);

    if (fresh.status === 'awaiting_ryan') {
      const reply =
        "You are in the queue — I already pinged Ryan. Keep this window open and he will join when he is free.";
      await insertMessage({ threadId, role: 'miranda', body: reply });
      const messages = await listMessages(threadId);
      res.json({
        ok: true,
        reply,
        threadId,
        visitorToken,
        status: fresh.status,
        messages: serializeMessages(messages),
        links: { book: `${URLS.www}/book`, vibeCheck: `${URLS.www}/service-audits`, inquiry: `${URLS.www}/inquiry` },
      });
      return;
    }

    if (fresh.status === 'live') {
      const messages = await listMessages(threadId);
      res.json({
        ok: true,
        reply: null,
        threadId,
        visitorToken,
        status: fresh.status,
        messages: serializeMessages(messages),
        links: { book: `${URLS.www}/book`, vibeCheck: `${URLS.www}/service-audits`, inquiry: `${URLS.www}/inquiry` },
      });
      return;
    }

    if (fresh.status === 'closed') {
      res.json({
        ok: true,
        reply: 'This chat is closed. Start a new conversation or email hello@creativebuilds.dev.',
        threadId,
        visitorToken,
        status: fresh.status,
        messages: serializeMessages(await listMessages(threadId)),
      });
      return;
    }

    const escalate =
      Boolean(req.body.escalate) ||
      /talk to (a )?human|speak to ryan|call me|urgent|real person/i.test(message);

    const ai = await openAiReply(message, history, {
      threadId,
      name,
      email,
      latestMessage: message,
    });
    let reply = ai?.reply || null;
    if (!reply) reply = matchFaq(message);
    if (!reply) {
      reply =
        'Got it. For a tailored answer we usually need a bit of context — try Free Service Audits (https://www.creativebuilds.dev/service-audits), Scope a project (https://www.creativebuilds.dev/inquiry), or ask me to ping Ryan for a live chat.';
    }

    if ((escalate || wantsLiveChat(message)) && !ai?.liveRequested) {
      await runTool(
        'request_live_chat',
        { name, email, reason: 'Visitor asked for Ryan / human' },
        { threadId, name, email, latestMessage: message },
      );
      reply +=
        "\n\nI am pinging Ryan now to see if he is available for a live chat. Keep this window open.";
    } else if (escalate || (email && /notify|contact|reach out|call me|email me/i.test(message))) {
      notifyRyanEscalation({ name, email, message, history }).catch(() => {});
      reply +=
        '\n\nI have notified Ryan — he will follow up as soon as he can. If it is urgent, email hello@creativebuilds.dev.';
    }

    if (reply) await insertMessage({ threadId, role: 'miranda', body: reply });

    const updated = await getThreadById(threadId);
    const messages = await listMessages(threadId);

    res.json({
      ok: true,
      reply,
      booking: ai?.booking || null,
      slots: ai?.slots || null,
      threadId,
      visitorToken,
      status: updated.status,
      messages: serializeMessages(messages),
      links: {
        book: `${URLS.www}/book`,
        vibeCheck: `${URLS.www}/service-audits`,
        inquiry: `${URLS.www}/inquiry`,
      },
    });
  } catch (err) {
    console.error('chat:', err);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

router.post('/live-request', async (req, res) => {
  try {
    const resolved = await resolveThread(req);
    if (resolved.error) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }
    const { threadId, visitorToken } = resolved;
    const name = req.body.name ? String(req.body.name).trim().slice(0, 120) : '';
    const email = req.body.email ? String(req.body.email).toLowerCase() : null;
    const message = String(req.body.message || 'Visitor requested live chat').trim();

    if (name || email) await setVisitorInfo(threadId, { name, email });
    if (message) await insertMessage({ threadId, role: 'visitor', body: message });

    const thread = await requestLiveChat(threadId, { name, email });
    const messages = await listAllMessages(threadId);
    await notifyRyanLiveChat({
      threadId,
      thread,
      messages,
      reason: 'Explicit live chat request',
      latestMessage: message,
    });
    const reply =
      "I am pinging Ryan now to see if he is available for a live chat. Keep this window open — he will join here when he is free.";
    await insertMessage({ threadId, role: 'miranda', body: reply });
    await insertMessage({ threadId, role: 'system', body: 'Live chat requested — pinging Ryan now.' });

    res.json({
      ok: true,
      reply,
      threadId,
      visitorToken,
      status: 'awaiting_ryan',
      messages: serializeMessages(await listMessages(threadId)),
    });
  } catch (err) {
    console.error('chat live-request:', err);
    res.status(500).json({ error: 'Live chat request failed' });
  }
});

router.get('/threads/:id', async (req, res) => {
  try {
    const visitorToken = String(req.query.visitorToken || req.headers['x-visitor-token'] || '').trim();
    if (!visitorToken) {
      res.status(400).json({ error: 'visitorToken required' });
      return;
    }
    const thread = await getThreadForVisitor(req.params.id, visitorToken);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const since = Number(req.query.since) || 0;
    const messages = await listMessages(thread.id, since);
    res.json({ ok: true, thread, messages: serializeMessages(messages) });
  } catch (err) {
    console.error('chat poll:', err);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

router.post('/threads/:id/messages', async (req, res) => {
  try {
    const visitorToken = String(req.body.visitorToken || req.headers['x-visitor-token'] || '').trim();
    const message = String(req.body.message || '').trim().slice(0, 2000);
    if (!visitorToken || !message) {
      res.status(400).json({ error: 'visitorToken and message required' });
      return;
    }
    const thread = await getThreadForVisitor(req.params.id, visitorToken);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (thread.status !== 'live' && thread.status !== 'awaiting_ryan') {
      res.status(409).json({ error: 'Thread not in live handoff mode' });
      return;
    }
    await insertMessage({ threadId: thread.id, role: 'visitor', body: message });
    const messages = await listMessages(thread.id);
    res.json({
      ok: true,
      thread,
      messages: serializeMessages(messages),
    });
  } catch (err) {
    console.error('chat visitor message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
