import https from 'node:https';

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

export async function notifyNewTicket(ticket, message) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL || 'hello@creativebuilds.dev';
  const from = process.env.NOTIFY_FROM || 'CreativeBuilds <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('notifyEmail: RESEND_API_KEY not set — ticket saved but no email sent');
    return false;
  }

  const name = ticket.contact_name || 'Someone';
  const replyEmail = ticket.contact_email || ticket.email;
  const phone = ticket.contact_phone ? `\nPhone: ${ticket.contact_phone}` : '';
  const subject = `[CreativeBuilds] ${ticket.subject}`;
  const text = [
    `New submission (#${ticket.id})`,
    '',
    `From: ${name}`,
    `Email: ${replyEmail}${phone}`,
    `Category: ${ticket.category}`,
    '',
    message,
    '',
    `View in admin: https://admin.creativebuilds.dev`,
  ].join('\n');

  try {
    const payload = { from, to: [to], subject, text };
    if (!replyEmail.includes('@tickets.creativebuilds.dev')) payload.reply_to = replyEmail;
    const res = await postResend(apiKey, payload);
    if (res.status < 200 || res.status >= 300) {
      console.error('notifyEmail: Resend failed', res.status, res.body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('notifyEmail: send error', err);
    return false;
  }
}
