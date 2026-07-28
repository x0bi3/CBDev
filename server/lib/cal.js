import https from 'node:https';
import { URL } from 'node:url';
import { query } from '../db.js';
import { URLS } from './urls.js';
import { clearStaleIntroIdempotency, alignBookingTimesToChicagoWall } from './calSlots.js';

const TZ = 'America/Chicago';

function calConfig() {
  return {
    apiKey: process.env.CAL_API_KEY || '',
    apiUrl: (process.env.CAL_API_URL || 'https://cal.creativebuilds.dev/api/v2').replace(/\/$/, ''),
    eventTypeId: process.env.CAL_FOLLOWUP_EVENT_TYPE_ID
      ? Number(process.env.CAL_FOLLOWUP_EVENT_TYPE_ID)
      : null,
    hostEmail: process.env.CAL_HOST_EMAIL || URLS.contactEmail,
    hostName: process.env.CAL_HOST_NAME || 'Ryan Baldwin',
  };
}

function requestJson(method, urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        family: 4,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'cal-api-version': '2024-08-13',
  };
}

/** Next weekday ~20h from now in America/Chicago, snapped to :00 or :30. */
export function followUpStartIso(from = new Date()) {
  const d = new Date(from.getTime() + 20 * 60 * 60 * 1000);
  // Prefer business hours 9–17 CT — if outside, push to next 10:00 CT
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  let hour = Number(parts.hour);
  let minute = Number(parts.minute) < 30 ? 0 : 30;
  let dayOffset = 0;
  const weekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';
  if (weekend || hour < 9 || hour >= 17) {
    hour = 10;
    minute = 0;
    if (weekend || hour >= 17) {
      dayOffset = parts.weekday === 'Sat' ? 2 : parts.weekday === 'Sun' ? 1 : hour >= 17 ? 1 : 0;
    }
  }
  // Build a Date in CT by using a known offset approximation via locale string
  const base = new Date(d.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
  // Interpret as CT wall time → ISO via temporal-less trick
  const guess = new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  // Adjust so that when formatted in CT it matches desired wall clock
  const ctHour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }).format(guess),
  );
  const deltaH = hour - ctHour;
  guess.setHours(guess.getHours() + deltaH);
  return guess.toISOString();
}

export async function createLeadFollowUpBooking({ inquiry, adminUrl }) {
  const cfg = calConfig();
  if (!cfg.apiKey || !cfg.eventTypeId) {
    console.warn('cal: CAL_API_KEY or CAL_FOLLOWUP_EVENT_TYPE_ID missing — skipped follow-up booking');
    return { ok: false, skipped: true };
  }

  const start = followUpStartIso();
  const notes = [
    `Follow up with ${inquiry.name} <${inquiry.email}>`,
    `Source: ${inquiry.source || 'inquiry'}`,
    inquiry.company ? `Company: ${inquiry.company}` : null,
    '',
    'Overview:',
    String(inquiry.overview || '').slice(0, 800),
    '',
    `Admin: ${adminUrl || URLS.admin}`,
  ]
    .filter((x) => x !== null)
    .join('\n');

  const body = {
    start,
    eventTypeId: cfg.eventTypeId,
    attendee: {
      name: inquiry.name,
      email: inquiry.email,
      timeZone: TZ,
    },
    metadata: {
      inquiryId: String(inquiry.id),
      source: inquiry.source || 'inquiry',
      kind: 'lead-follow-up',
    },
    bookingFieldsResponses: {
      notes,
    },
  };

  try {
    const res = await requestJson('POST', `${cfg.apiUrl}/bookings`, body, authHeaders(cfg.apiKey));
    if (res.status < 200 || res.status >= 300) {
      console.error('cal: create booking failed', res.status, JSON.stringify(res.body).slice(0, 500));
      return { ok: false, error: res.body };
    }
    const uid =
      res.body?.data?.uid ||
      res.body?.data?.id ||
      res.body?.uid ||
      res.body?.id ||
      null;
    if (uid && inquiry.id) {
      await query('UPDATE inquiry_submissions SET cal_booking_uid = $1 WHERE id = $2', [
        String(uid),
        inquiry.id,
      ]);
    }
    console.log(`cal: follow-up booked for inquiry #${inquiry.id} uid=${uid} start=${start}`);
    return { ok: true, uid: uid ? String(uid) : null, start, raw: res.body };
  } catch (err) {
    console.error('cal: create booking error', err);
    return { ok: false, error: String(err) };
  }
}

export async function patchBookingDescription(uid, description) {
  const cfg = calConfig();
  if (!cfg.apiKey || !uid) return { ok: false, skipped: true };
  try {
    // Best-effort: Cal v2 booking update endpoints vary by version
    const res = await requestJson(
      'PATCH',
      `${cfg.apiUrl}/bookings/${encodeURIComponent(uid)}`,
      { description },
      authHeaders(cfg.apiKey),
    );
    if (res.status < 200 || res.status >= 300) {
      console.warn('cal: patch booking failed', res.status, JSON.stringify(res.body).slice(0, 300));
      return { ok: false, error: res.body };
    }
    return { ok: true };
  } catch (err) {
    console.warn('cal: patch booking error', err);
    return { ok: false, error: String(err) };
  }
}

export function verifyCalWebhook(req) {
  const secret = process.env.CAL_WEBHOOK_SECRET || '';
  if (!secret) return true;
  const header =
    req.headers['x-cal-signature-256'] ||
    req.headers['x-cal-signature'] ||
    req.headers['cal-signature'] ||
    '';
  if (header && (String(header) === secret || String(header).includes(secret))) return true;
  if (req.query?.secret && String(req.query.secret) === secret) return true;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

function calWebappUrl() {
  return (process.env.CAL_WEBAPP_URL || 'https://cal.creativebuilds.dev').replace(/\/$/, '');
}

function introEventTypeId() {
  return Number(process.env.CAL_INTRO_EVENT_TYPE_ID || 2);
}

/**
 * Book Intro Call (Discovery) via Cal.diy Next.js booker API.
 * Body shape matches live /api/book/event.
 */
export async function createIntroBooking({
  name,
  email,
  phone,
  startIso,
  company,
  notes,
  metadata = {},
}) {
  const eventTypeId = introEventTypeId();
  const trueUtc = new Date(startIso);
  if (Number.isNaN(trueUtc.getTime())) {
    return { ok: false, error: 'Invalid start time', status: 400 };
  }
  // Cal /api/book/event availability checks expect a real UTC instant.
  const start = trueUtc.toISOString();
  const responses = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
  };
  if (phone) responses.attendeePhoneNumber = String(phone).trim();
  if (notes || company) {
    responses.notes = [company ? `Company: ${company}` : null, notes || null]
      .filter(Boolean)
      .join('\n');
  }

  const meta = {
    source: 'retell-receptionist',
    kind: 'discovery-intro-call',
  };
  for (const [k, v] of Object.entries(metadata || {})) {
    if (v !== null && v !== undefined && v !== '') meta[k] = String(v);
  }

  const body = {
    eventTypeId,
    start,
    responses,
    timeZone: TZ,
    language: 'en',
    metadata: meta,
  };

  const labelFor = () =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(trueUtc);

  const successFrom = async (payload, note = '') => {
    const uid = payload?.uid || payload?.data?.uid || null;
    if (uid) {
      try {
        await alignBookingTimesToChicagoWall(uid, trueUtc, 30);
      } catch (err) {
        console.error('cal: wall-align failed', err);
      }
    }
    console.log(`cal: intro booked uid=${uid} start=${start}${note}`);
    return {
      ok: true,
      uid: uid ? String(uid) : null,
      start,
      label: labelFor(),
      title: payload?.title || 'Intro Call',
      eventTypeId,
      bookingUrl: uid ? `${calWebappUrl()}/booking/${uid}` : null,
      raw: payload,
    };
  };

  try {
    // Cancelled rows sometimes keep idempotencyKey (Cal bug/path). Clear before book
    // so Retell retries on the same slot don't 500 on Booking_idempotencyKey_key.
    await clearStaleIntroIdempotency(start);

    let res = await requestJson('POST', `${calWebappUrl()}/api/book/event`, body);
    if (res.status >= 200 && res.status < 300) return successFrom(res.body);

    if (res.status === 409) {
      return { ok: false, conflict: true, error: res.body, status: 409 };
    }

    const msg = String(res.body?.message || '');
    const maybeStaleKey = /querying the database|idempotency|duplicate/i.test(msg);
    console.error('cal: intro book failed', res.status, JSON.stringify(res.body).slice(0, 500));

    if (maybeStaleKey) {
      await clearStaleIntroIdempotency(start);
      res = await requestJson('POST', `${calWebappUrl()}/api/book/event`, body);
      if (res.status >= 200 && res.status < 300) {
        return successFrom(res.body, ' (after idempotency clear)');
      }
    }

    const conflict =
      res.status === 409 || /no_available|already|conflict|duplicate/i.test(String(res.body?.message || ''));
    return {
      ok: false,
      conflict,
      error: res.body,
      status: conflict ? 409 : res.status >= 400 ? res.status : 422,
    };
  } catch (err) {
    console.error('cal: intro book error', err);
    return { ok: false, error: String(err), status: 422 };
  }
}
