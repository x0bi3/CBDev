import https from 'node:https';
import { URLS } from './urls.js';

function mailFrom() {
  return process.env.NOTIFY_FROM || 'CreativeBuilds <onboarding@resend.dev>';
}

/** Client-facing free audit From — REPORT_FROM / notifications@; Reply-To is hello@. */
function reportMailFrom() {
  return process.env.REPORT_FROM || process.env.NOTIFY_FROM || 'CreativeBuilds <notifications@creativebuilds.dev>';
}

function adminEmail() {
  return URLS.contactEmail;
}

function postResend(apiKey, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      family: 4,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export async function sendEmail({ to, subject, text, html, replyTo, from }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('email: RESEND_API_KEY not set — skipped', subject);
    return { ok: false, skipped: true };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    from: from || mailFrom(),
    to: recipients,
    subject,
    text,
  };
  if (html) payload.html = html;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await postResend(apiKey, payload);
    if (res.status < 200 || res.status >= 300) {
      // Retry once with NOTIFY_FROM if hello@ was rejected (unverified sender)
      if (from && from !== mailFrom()) {
        console.warn('email: primary from rejected, retrying with NOTIFY_FROM', res.status, res.body);
        return sendEmail({ to, subject, text, html, replyTo, from: mailFrom() });
      }
      console.error('email: Resend failed', res.status, res.body);
      return { ok: false, error: res.body };
    }
    return { ok: true };
  } catch (err) {
    console.error('email: send error', err);
    return { ok: false, error: String(err) };
  }
}

export async function notifyNewInquiry(inquiry) {
  const categories = Array.isArray(inquiry.categories)
    ? inquiry.categories.join(', ')
    : JSON.stringify(inquiry.categories);
  const answerLines = Object.entries(inquiry.answers || {}).map(
    ([k, v]) => `${k}: ${v}`,
  );
  const source = String(inquiry.source || '');
  const isFreeAudit = source === 'free-website-audit' || source === 'vibe-check';
  const label = isFreeAudit
    ? (source === 'free-website-audit' ? 'Free Website Audit' : 'Free Service Audit')
    : 'Project inquiry';
  return sendEmail({
    to: adminEmail(),
    subject: `[${label}] ${inquiry.name}`,
    text: [
      `New ${label.toLowerCase()} (#${inquiry.id})`,
      '',
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      inquiry.company ? `Company: ${inquiry.company}` : '',
      inquiry.source ? `Source: ${inquiry.source}` : '',
      `Categories: ${categories}`,
      inquiry.budget ? `Budget: ${inquiry.budget}` : '',
      inquiry.timeline ? `Timeline: ${inquiry.timeline}` : '',
      '',
      'Overview:',
      inquiry.overview,
      '',
      ...(answerLines.length ? ['Details:', ...answerLines, ''] : []),
      'Cal follow-up is starting automatically.',
      `View in admin: ${URLS.admin}`,
    ].filter(Boolean).join('\n'),
    replyTo: inquiry.email,
  });
}

export async function sendInquiryConfirmation(inquiry) {
  const source = String(inquiry.source || '');
  const isFreeAudit = source === 'free-website-audit' || source === 'vibe-check';
  const subject = isFreeAudit
    ? 'We got your Free Website Audit request'
    : 'We got your project inquiry';
  const thanks = isFreeAudit
    ? 'Thanks — your free automated website report is running now. You will get a second email with the link when it is ready (usually a few minutes).'
    : 'Thanks for reaching out. I read every inquiry personally and aim to reply within 12 hours on business days.';
  return sendEmail({
    to: inquiry.email,
    subject,
    text: [
      `Hi ${inquiry.name},`,
      '',
      thanks,
      '',
      'What you sent:',
      inquiry.overview,
      '',
      'If you need to add anything, reply to this email.',
      '',
      'Ryan Baldwin',
      'CreativeBuilds',
      URLS.contactEmail,
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

function overallFromScores(scores) {
  if (!scores || typeof scores !== 'object') return null;
  if (typeof scores.overall === 'number') return scores.overall;
  return null;
}

export async function sendFreeAuditReady(report) {
  const overall = overallFromScores(report.scores);
  const link = `${URLS.www}/report/${report.public_token}`;
  const scoreLine = overall == null ? '' : `Overall score: ${overall}/100`;
  return sendEmail({
    to: report.email,
    from: reportMailFrom(),
    subject: 'Your CreativeBuilds website report is ready',
    text: [
      `Hi ${report.name},`,
      '',
      'Your free CreativeBuilds website report is ready.',
      `URL audited: ${report.url}`,
      scoreLine,
      '',
      `Open your report: ${link}`,
      '',
      'Inside you will find an overview plus sections for performance, SEO, accessibility, security, and technical hygiene — with what is wrong and how I would fix it.',
      '',
      'This free report link expires in 24 hours.',
      '',
      'Not enough time to dig in? Reply to this email or use the hand-raise CTA in any section and I will step in.',
      '',
      '— Ryan · CreativeBuilds',
      URLS.contactEmail,
    ].filter(Boolean).join('\n'),
    html: [
      `<p>Hi ${escapeHtml(report.name)},</p>`,
      '<p>Your free <strong>CreativeBuilds</strong> website report is ready.</p>',
      `<p>URL audited: <a href="${escapeHtml(report.url)}">${escapeHtml(report.url)}</a></p>`,
      overall == null ? '' : `<p>Overall score: <strong>${overall}/100</strong></p>`,
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#d97706;color:#111;text-decoration:none;border-radius:6px;font-weight:600;">Open your report</a></p>`,
      '<p>Inside: overview plus Performance, SEO, Accessibility, Security, and Technical sections — what is wrong, how I would fix it, and a soft hand-raise if you want me to step in.</p>',
      '<p style="color:#666;font-size:13px;">This free report link expires in 24 hours.</p>',
      `<p>— Ryan · CreativeBuilds<br/><a href="mailto:${URLS.contactEmail}">${URLS.contactEmail}</a></p>`,
    ].filter(Boolean).join('\n'),
    replyTo: adminEmail(),
  });
}

export async function notifyFreeAuditReady(report) {
  const overall = overallFromScores(report.scores);
  const link = `${URLS.www}/report/${report.public_token}`;
  const failed = report.status === 'failed';
  return sendEmail({
    to: adminEmail(),
    subject: failed
      ? `[Internal] Free Website Audit FAILED · ${report.name}`
      : `[Internal] Free Website Audit ready · ${report.name}${overall != null ? ` · ${overall}/100` : ''}`,
    text: [
      failed ? 'Free website audit failed (internal lead)' : 'Free website audit ready (internal lead)',
      '',
      `Name: ${report.name}`,
      `Email: ${report.email}`,
      `URL: ${report.url}`,
      `Token: ${report.public_token}`,
      overall != null ? `Overall: ${overall}/100` : '',
      report.error ? `Error: ${report.error}` : '',
      '',
      `Report (www): ${link}`,
      `Admin: ${URLS.admin}`,
    ].filter(Boolean).join('\n'),
  });
}

export async function notifyFreeAuditWaitlist(row) {
  return sendEmail({
    to: adminEmail(),
    subject: `[Audit waitlist] ${row.service_slug} · ${row.email}`,
    text: [
      'Someone joined a Free Service Audit waitlist.',
      '',
      `Service: ${row.service_slug}`,
      `Name: ${row.name || '—'}`,
      `Email: ${row.email}`,
      `Id: ${row.id}`,
    ].join('\n'),
    replyTo: row.email,
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendBookingConfirmation(booking) {
  const to = booking.attendeeEmail || booking.email;
  if (!to) return { ok: false, skipped: true };
  const name = booking.attendeeName || booking.name || 'there';
  return sendEmail({
    to,
    subject: `You're booked — ${booking.title || 'CreativeBuilds call'}`,
    text: [
      `Hi ${name},`,
      '',
      'Your call with CreativeBuilds is confirmed.',
      booking.startsAt ? `When: ${booking.startsAt}` : '',
      booking.location ? `Where: ${booking.location}` : '',
      '',
      'I will review your presence ahead of time so we can use the call for decisions, not discovery of basics.',
      '',
      'Need to reschedule? Use the link in your Cal confirmation email.',
      '',
      '— Ryan · CreativeBuilds',
      URLS.contactEmail,
    ]
      .filter(Boolean)
      .join('\n'),
    replyTo: adminEmail(),
  });
}

export async function notifyBookingCreated(booking) {
  return sendEmail({
    to: adminEmail(),
    subject: `[Call booked] ${booking.attendeeName || booking.attendeeEmail || 'Guest'}`,
    text: [
      'New discovery / intro booking',
      '',
      `Title: ${booking.title || '—'}`,
      `Guest: ${booking.attendeeName || '—'} <${booking.attendeeEmail || '—'}>`,
      booking.startsAt ? `When: ${booking.startsAt}` : '',
      booking.uid ? `Cal uid: ${booking.uid}` : '',
      '',
      `Admin: ${URLS.admin}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

export async function notifyNewTicket(ticket, message) {
  const name = ticket.contact_name || 'Someone';
  const replyEmail = ticket.contact_email || ticket.email;
  const phone = ticket.contact_phone ? `\nPhone: ${ticket.contact_phone}` : '';
  return sendEmail({
    to: adminEmail(),
    subject: `[CreativeBuilds] ${ticket.subject}`,
    text: [
      `New submission (#${ticket.id})`,
      '',
      `From: ${name}`,
      `Email: ${replyEmail}${phone}`,
      `Category: ${ticket.category}`,
      '',
      message,
      '',
      `View in admin: ${URLS.admin}`,
    ].join('\n'),
    replyTo: replyEmail.includes('@tickets.creativebuilds.dev') ? undefined : replyEmail,
  });
}

export async function sendTicketConfirmation(ticket, message) {
  const to = ticket.contact_email || ticket.email;
  if (!to || to.includes('@tickets.creativebuilds.dev')) return { ok: false, skipped: true };
  const name = ticket.contact_name || 'there';
  return sendEmail({
    to,
    subject: 'We received your message — CreativeBuilds',
    text: [
      `Hi ${name},`,
      '',
      'Thanks for reaching out. Your message is in our queue and we aim to reply within 12 hours on business days.',
      '',
      `Subject: ${ticket.subject}`,
      '',
      message,
      '',
      '— Ryan · CreativeBuilds',
      URLS.contactEmail,
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

export async function sendNewsletterWelcome(email) {
  return sendEmail({
    to: email,
    subject: 'You\'re on the CreativeBuilds list',
    text: [
      'Thanks for subscribing.',
      '',
      'You\'ll get occasional notes on what we\'re building — no spam, unsubscribe any time by replying to this email.',
      '',
      '— Ryan · CreativeBuilds',
      URLS.studio,
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

export async function sendNewsletterBroadcast({ subject, body, recipients }) {
  const results = { sent: 0, failed: 0 };
  for (const email of recipients) {
    const r = await sendEmail({
      to: email,
      subject,
      text: body,
      replyTo: adminEmail(),
    });
    if (r.ok) results.sent += 1;
    else results.failed += 1;
  }
  return results;
}

function formatMoney(cents) {
  return `£${(cents / 100).toFixed(2)}`;
}

function formatUsd(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Public base for the client quote page (test now, portable to www at cutover). */
export function quotePublicBase() {
  return process.env.QUOTE_PUBLIC_URL || process.env.MARKETING_CHECKOUT_SUCCESS_URL || 'https://test.creativebuilds.dev';
}

export function quoteLink(publicId) {
  return `${quotePublicBase().replace(/\/$/, '')}/quote?id=${encodeURIComponent(publicId)}`;
}

/** Sends the quote + pay link to the client. */
export async function sendQuoteToClient(quote) {
  const items = Array.isArray(quote.line_items) ? quote.line_items : [];
  const lines = items.map((i) => `  - ${i.n}${i.u ? ` (/${i.u})` : ''}`);
  const greeting = quote.client_name ? `Hi ${quote.client_name},` : 'Hi,';
  return sendEmail({
    to: quote.client_email,
    subject: `Your CreativeBuilds quote ${quote.public_id}`,
    text: [
      greeting,
      '',
      'Here is your quote from CreativeBuilds:',
      '',
      `Quote ID: ${quote.public_id}`,
      quote.category ? `Project: ${quote.category}` : '',
      '',
      ...(lines.length ? ['What is included:', ...lines, ''] : []),
      `Total: ${formatUsd(quote.total_cents)}`,
      `Deposit to start (${quote.deposit_pct || 25}%): ${formatUsd(quote.deposit_cents)}`,
      '',
      'Review and pay your deposit here:',
      quoteLink(quote.public_id),
      '',
      'Paying the deposit reserves your spot and starts your CreativeBuilds account. Deposits are refundable within 48 hours.',
      '',
      '— Ryan · CreativeBuilds',
      URLS.contactEmail,
    ].filter(Boolean).join('\n'),
    replyTo: adminEmail(),
  });
}

/** After deposit paid: onboarding + set-password link for the new account. */
export async function sendQuotePaidWelcome(user, quote, setPasswordUrl) {
  const greeting = user.name ? `Hi ${user.name},` : 'Hi,';
  return sendEmail({
    to: user.email,
    subject: 'Deposit received — welcome to CreativeBuilds',
    text: [
      greeting,
      '',
      `Thanks — we received your deposit of ${formatUsd(quote.deposit_cents)} for quote ${quote.public_id}.`,
      '',
      'Your CreativeBuilds account is ready. Set your password to sign in and track your project:',
      setPasswordUrl,
      '',
      'This link expires in 24 hours. If it lapses, use "Forgot password" on the sign-in screen.',
      '',
      'We will be in touch shortly to kick off the work.',
      '',
      '— Ryan · CreativeBuilds',
      URLS.contactEmail,
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

/** Notifies admin a quote was paid. */
export async function notifyQuotePaid(quote) {
  return sendEmail({
    to: adminEmail(),
    subject: `[Quote paid] ${quote.public_id} — ${formatUsd(quote.deposit_cents)} deposit`,
    text: [
      `Quote ${quote.public_id} deposit paid.`,
      '',
      quote.client_name ? `Client: ${quote.client_name}` : '',
      `Email: ${quote.client_email}`,
      `Total: ${formatUsd(quote.total_cents)}`,
      `Deposit: ${formatUsd(quote.deposit_cents)}`,
      '',
      `View in admin: ${URLS.admin}`,
    ].filter(Boolean).join('\n'),
    replyTo: quote.client_email,
  });
}

/** Password reset link for studio sign-in. */
export async function sendPasswordResetEmail(user, resetUrl) {
  const greeting = user.name ? `Hi ${user.name},` : 'Hi,';
  return sendEmail({
    to: user.email,
    subject: 'Reset your CreativeBuilds password',
    text: [
      greeting,
      '',
      'We received a request to reset your CreativeBuilds password.',
      '',
      'Set a new password here (link expires in 1 hour):',
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
      '',
      '— CreativeBuilds',
      URLS.contactEmail,
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

export async function sendOrderConfirmation(order, items) {
  const lines = items.map((i) =>
    `  ${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} — ${formatMoney(i.line_total_cents)}`,
  );
  return sendEmail({
    to: order.email,
    subject: `Order ${order.order_number} confirmed — CreativeBuilds`,
    text: [
      `Hi ${order.customer_name},`,
      '',
      'Thanks for your order. Here\'s what we\'re preparing:',
      '',
      ...lines,
      '',
      `Total: ${formatMoney(order.subtotal_cents)}`,
      '',
      'Shipping to:',
      order.customer_name,
      order.address_line,
      `${order.city} ${order.postcode}`,
      '',
      'We\'ll email you when it ships. Questions? Reply to this email.',
      '',
      '— CreativeBuilds Merch',
    ].join('\n'),
    replyTo: adminEmail(),
  });
}

export async function notifyNewOrder(order, items) {
  const lines = items.map((i) =>
    `  ${i.quantity}× ${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} — ${formatMoney(i.line_total_cents)}`,
  );
  return sendEmail({
    to: adminEmail(),
    subject: `[Merch] Order ${order.order_number}`,
    text: [
      `New merch order ${order.order_number}`,
      '',
      `Customer: ${order.customer_name}`,
      `Email: ${order.email}`,
      `Address: ${order.address_line}, ${order.city} ${order.postcode}`,
      '',
      ...lines,
      '',
      `Total: ${formatMoney(order.subtotal_cents)}`,
    ].join('\n'),
    replyTo: order.email,
  });
}
