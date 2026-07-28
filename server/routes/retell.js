import { Router } from 'express';
import { listIntroSlots } from '../lib/calSlots.js';
import { createIntroBooking } from '../lib/cal.js';
import { sendEmail } from '../lib/email.js';
import { URLS } from '../lib/urls.js';

const router = Router();

function bridgeSecret() {
  return process.env.RETELL_BRIDGE_SECRET || '';
}

function transferNumber() {
  return process.env.RETELL_TRANSFER_NUMBER || '+16083440203';
}

function requireBridgeAuth(req, res, next) {
  const secret = bridgeSecret();
  if (!secret) {
    res.status(503).json({ error: 'RETELL_BRIDGE_SECRET is not configured' });
    return;
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const alt = req.headers['x-retell-secret'] || req.query?.secret || '';
  if (token !== secret && String(alt) !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireBridgeAuth);

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'retell-cal-bridge',
    transferNumber: transferNumber(),
    introEventTypeId: Number(process.env.CAL_INTRO_EVENT_TYPE_ID || 2),
    calWebapp: process.env.CAL_WEBAPP_URL || 'https://cal.creativebuilds.dev',
    slotsConfigured: Boolean(process.env.CAL_DATABASE_URL),
  });
});

router.get('/slots', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 30);
    const data = await listIntroSlots({
      from: req.query.from,
      to: req.query.to,
      limit,
    });
    res.json({
      ok: true,
      transferNumber: transferNumber(),
      ...data,
    });
  } catch (err) {
    console.error('retell slots:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to load slots' });
  }
});

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function looksLikePhone(value) {
  const digits = digitsOnly(value);
  if (digits.length < 10 || digits.length > 15) return false;
  const lower = String(value || '').trim().toLowerCase();
  if (['yes', 'no', 'ok', 'okay', 'yep', 'yeah', 'correct', 'this number'].includes(lower)) {
    return false;
  }
  return true;
}

/** E.164-ish for US when possible; keep international digits otherwise. */
function normalizePhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (String(value || '').trim().startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return String(value || '').trim();
}

/**
 * Retell often extracts last-7 / last-4 when the caller confirms caller ID out loud.
 * Prefer a full inbound {{user_number}} when the fragment is clearly that same line.
 */
function resolvePhone(body = {}) {
  const candidates = [
    body.phone,
    body.phoneNumber,
    body.callbackPhone,
    body.caller_phone,
    body.fromNumber,
    body.from_number,
    body.user_number,
    body.userNumber,
    body.callerId,
    body.caller_id,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const full = [];
  const partial = [];
  for (const raw of candidates) {
    const norm = normalizePhone(raw);
    if (looksLikePhone(norm)) full.push(norm);
    else {
      const d = digitsOnly(raw);
      if (d.length >= 4 && d.length < 10) partial.push(d);
    }
  }

  if (full.length) {
    // Prefer an explicit callback that isn't only the inbound ANI when both exist.
    return full[0];
  }

  for (const frag of partial) {
    for (const cand of candidates) {
      const d = digitsOnly(cand);
      if (d.length >= 10 && d.endsWith(frag)) return normalizePhone(cand);
    }
  }

  return candidates[0] || '';
}

router.post('/book', async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    const phone = resolvePhone(b);
    const start = b.start || b.startIso;
    if (!name || !email || !start) {
      res.status(400).json({ ok: false, error: 'name, email, and start are required' });
      return;
    }
    if (!looksLikePhone(phone)) {
      res.status(400).json({
        ok: false,
        error: 'phone must be a real phone number with at least 10 digits (not yes/no)',
        speak:
          'I still need a full ten-digit callback number before I can book. What is the best number for Ryan to reach you?',
      });
      return;
    }
    const callId = b.callId || b.call_id || '';
    const result = await createIntroBooking({
      name,
      email,
      phone: normalizePhone(phone),
      startIso: start,
      company: b.company,
      notes: b.notes,
      metadata: callId ? { retellCallId: String(callId) } : {},
    });
    if (!result.ok) {
      // Use 409/422 — not 502. Cloudflare turns origin 502 into an HTML bad-gateway page
      // that Retell can't parse.
      const status = result.conflict ? 409 : Number(result.status) >= 400 && Number(result.status) < 500
        ? Number(result.status)
        : 422;
      res.status(status).json({
        ok: false,
        conflict: Boolean(result.conflict),
        error: result.error || 'Booking failed',
        transferNumber: transferNumber(),
        speak: result.conflict
          ? 'That time just got taken. I can offer another open slot.'
          : 'I hit a snag booking that time. I can try another slot or connect you with Ryan.',
      });
      return;
    }
    res.status(201).json({
      ok: true,
      uid: result.uid,
      start: result.start,
      label: result.label,
      title: result.title,
      bookingUrl: result.bookingUrl,
      transferNumber: transferNumber(),
      speak: `You're booked for a free 30-minute Intro Call with Ryan on ${result.label} Central Time. You'll get a confirmation email at ${email}.`,
    });
  } catch (err) {
    console.error('retell book:', err);
    res.status(500).json({ ok: false, error: err.message || 'Booking failed' });
  }
});

router.post('/escalate', async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || 'Caller').trim().slice(0, 120);
    const phone = String(b.phone || b.phoneNumber || '').trim().slice(0, 40);
    const email = String(b.email || '').trim().slice(0, 160);
    const reason = String(b.reason || b.summary || b.message || 'Wants to speak with Ryan').trim().slice(0, 2000);
    const transcript = String(b.transcript || '').trim().slice(0, 8000);

    await sendEmail({
      to: URLS.contactEmail,
      subject: `[Miranda phone] ${name} needs you`,
      text: [
        'Miranda (Retell) escalated an inbound call.',
        '',
        `Name: ${name}`,
        phone ? `Phone: ${phone}` : null,
        email ? `Email: ${email}` : null,
        `Transfer number: ${transferNumber()}`,
        '',
        'Reason:',
        reason,
        '',
        transcript ? 'Transcript / notes:\n' + transcript : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    res.json({
      ok: true,
      transferNumber: transferNumber(),
      speak: `I can connect you with Ryan now at his line, or take a message and he will call you back within 12 business hours. Which do you prefer?`,
    });
  } catch (err) {
    console.error('retell escalate:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Escalate failed',
      transferNumber: transferNumber(),
    });
  }
});

export default router;
