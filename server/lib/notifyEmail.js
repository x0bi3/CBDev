const RESEND_API = 'https://api.resend.com/emails';

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
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyEmail.includes('@tickets.creativebuilds.dev') ? undefined : replyEmail,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('notifyEmail: Resend failed', res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('notifyEmail: send error', err);
    return false;
  }
}
