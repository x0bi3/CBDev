/**
 * Notify Ryan when Miranda escalates or a visitor requests live chat.
 * SMS + voice ring to RETELL_TRANSFER_NUMBER; email always as durable log.
 */
import { sendEmail } from './email.js';
import { URLS } from './urls.js';
import { logNotification } from './mirandaChat.js';

function twilioAuth() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_CLIENT_SECRET;
  if (!sid || !token) return null;
  return { sid, token, auth: Buffer.from(`${sid}:${token}`).toString('base64') };
}

function ryanPhone() {
  return process.env.RETELL_TRANSFER_NUMBER || '+16083440203';
}

function fromPhone() {
  return process.env.TWILIO_PHONE_NUMBER || process.env.RETELL_PHONE_NUMBER;
}

async function twilioPost(path, form) {
  const auth = twilioAuth();
  if (!auth) throw new Error('Twilio not configured');
  const body = new URLSearchParams(form);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${auth.sid}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth.auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Twilio ${res.status}`);
  }
  return data;
}

export async function sendTwilioSms({ to, body }) {
  const from = fromPhone();
  if (!from) throw new Error('TWILIO_PHONE_NUMBER not set');
  return twilioPost('/Messages.json', { To: to, From: from, Body: body });
}

export async function sendTwilioVoiceRing({ to, message }) {
  const from = fromPhone();
  if (!from) throw new Error('TWILIO_PHONE_NUMBER not set');
  const say = String(message || 'Miranda has a live chat waiting on the admin panel.').slice(0, 300);
  const twiml = `<Response><Say voice="alice">${say.replace(/[<>&"']/g, '')}</Say></Response>`;
  return twilioPost('/Calls.json', { To: to, From: from, Twiml: twiml });
}

function formatHistory(messages = [], limit = 12) {
  return messages
    .slice(-limit)
    .map((m) => `${m.role}: ${String(m.body || '').slice(0, 500)}`)
    .join('\n');
}

/**
 * @param {{ threadId: string, thread?: object, messages?: object[], reason?: string, latestMessage?: string }} opts
 */
export async function notifyRyanLiveChat(opts) {
  const threadId = opts.threadId;
  const thread = opts.thread || {};
  const messages = opts.messages || [];
  const adminUrl = `${URLS.admin}/?section=live-chat&thread=${threadId}`;
  const visitor = thread.visitorName || thread.visitor_name || 'Visitor';
  const email = thread.visitorEmail || thread.visitor_email || '';
  const latest = opts.latestMessage || messages[messages.length - 1]?.body || '';
  const reason = opts.reason || 'Live chat requested';

  const smsBody =
    `Miranda: ${reason}\n` +
    `${visitor}${email ? ` (${email})` : ''}\n` +
    `${String(latest).slice(0, 120)}\n` +
    adminUrl;

  const emailText = [
    reason,
    '',
    `Visitor: ${visitor}`,
    email ? `Email: ${email}` : null,
    `Thread: ${threadId}`,
    '',
    'Latest:',
    latest,
    '',
    'Recent history:',
    formatHistory(messages),
    '',
    `Admin: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const results = { sms: null, call: null, email: null };

  const to = ryanPhone();

  try {
    const sms = await sendTwilioSms({ to, body: smsBody });
    results.sms = sms.sid;
    await logNotification({ threadId, channel: 'sms', status: 'sent', providerId: sms.sid });
  } catch (err) {
    console.error('notifyRyan: sms failed', err.message);
    await logNotification({ threadId, channel: 'sms', status: 'failed', error: err.message });
  }

  try {
    const call = await sendTwilioVoiceRing({
      to,
      message: 'Miranda has a live chat waiting on the Creative Builds admin panel.',
    });
    results.call = call.sid;
    await logNotification({ threadId, channel: 'call', status: 'sent', providerId: call.sid });
  } catch (err) {
    console.error('notifyRyan: call failed', err.message);
    await logNotification({ threadId, channel: 'call', status: 'failed', error: err.message });
  }

  try {
    await sendEmail({
      to: URLS.contactEmail,
      subject: `[Miranda live chat] ${visitor} — ${reason}`,
      text: emailText,
      replyTo: email || undefined,
    });
    results.email = 'sent';
    await logNotification({ threadId, channel: 'email', status: 'sent' });
  } catch (err) {
    console.error('notifyRyan: email failed', err.message);
    await logNotification({ threadId, channel: 'email', status: 'failed', error: err.message });
  }

  return results;
}

/** Legacy chat escalate — email + optional SMS ping */
export async function notifyRyanEscalation({ name, email, message, history = [] }) {
  const subject = `[Miranda chat] ${name || email || 'Visitor'} needs you`;
  const text = [
    'Miranda escalated a chat.',
    '',
    name ? `Name: ${name}` : null,
    email ? `Email: ${email}` : null,
    '',
    'Latest message:',
    message,
    '',
    history.length ? 'Recent history:' : null,
    ...history.map((h) => `${h.role}: ${h.text}`),
    '',
    `Admin: ${URLS.admin}`,
  ]
    .filter(Boolean)
    .join('\n');

  await sendEmail({
    to: URLS.contactEmail,
    subject,
    text,
    replyTo: email || undefined,
  }).catch((err) => console.error('escalate email failed', err));

  try {
    const to = ryanPhone();
    await sendTwilioSms({
      to,
      body: `Miranda chat escalate: ${String(message).slice(0, 100)}\n${URLS.admin}`,
    });
  } catch {
    /* optional */
  }
}
