import https from 'node:https';
import { URLS } from './urls.js';

function mailFrom() {
  return process.env.NOTIFY_FROM || 'CreativeBuilds <onboarding@resend.dev>';
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

export async function sendEmail({ to, subject, text, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('email: RESEND_API_KEY not set — skipped', subject);
    return { ok: false, skipped: true };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    from: mailFrom(),
    to: recipients,
    subject,
    text,
  };
  if (html) payload.html = html;
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await postResend(apiKey, payload);
    if (res.status < 200 || res.status >= 300) {
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
  return sendEmail({
    to: adminEmail(),
    subject: `[Project inquiry] ${inquiry.name}`,
    text: [
      `New project inquiry (#${inquiry.id})`,
      '',
      `Name: ${inquiry.name}`,
      `Email: ${inquiry.email}`,
      inquiry.company ? `Company: ${inquiry.company}` : '',
      `Categories: ${categories}`,
      inquiry.budget ? `Budget: ${inquiry.budget}` : '',
      inquiry.timeline ? `Timeline: ${inquiry.timeline}` : '',
      '',
      'Overview:',
      inquiry.overview,
      '',
      ...(answerLines.length ? ['Details:', ...answerLines, ''] : []),
      `View in admin: ${URLS.admin}`,
    ].filter(Boolean).join('\n'),
    replyTo: inquiry.email,
  });
}

export async function sendInquiryConfirmation(inquiry) {
  return sendEmail({
    to: inquiry.email,
    subject: 'We got your project inquiry',
    text: [
      `Hi ${inquiry.name},`,
      '',
      'Thanks for reaching out. I read every inquiry personally and aim to reply within 12 hours on business days.',
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
