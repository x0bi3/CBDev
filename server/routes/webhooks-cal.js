import { Router } from 'express';
import { verifyCalWebhook } from '../lib/cal.js';
import { sendBookingConfirmation, notifyBookingCreated } from '../lib/email.js';

const router = Router();

function pickBooking(payload) {
  const root = payload?.payload || payload?.data || payload || {};
  const responses = root.responses || {};
  const attendee =
    root.attendees?.[0] ||
    root.attendee ||
    {
      name: responses.name?.value || responses.name || root.title,
      email: responses.email?.value || responses.email || root.email,
    };
  return {
    uid: root.uid || root.bookingUid || root.id || null,
    title: root.title || root.eventTitle || root.type || 'CreativeBuilds call',
    startsAt: root.startTime || root.start || root.startsAt || null,
    location: root.location || root.meetingUrl || '',
    attendeeName: attendee?.name || attendee?.fullName || 'Guest',
    attendeeEmail: (attendee?.email || '').toLowerCase(),
    eventTypeSlug: root.eventTypeSlug || root.type || root.eventTitle || '',
    metadata: root.metadata || {},
  };
}

function isLeadFollowUp(booking) {
  const slug = String(booking.eventTypeSlug || '').toLowerCase();
  const kind = String(booking.metadata?.kind || '').toLowerCase();
  return kind === 'lead-follow-up' || slug.includes('lead-follow') || slug.includes('follow-up');
}

router.post('/', async (req, res) => {
  if (!verifyCalWebhook(req)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const trigger =
    req.body?.triggerEvent ||
    req.body?.trigger ||
    req.headers['x-cal-trigger'] ||
    'BOOKING_CREATED';
  const booking = pickBooking(req.body);

  console.log(`cal-webhook: ${trigger} uid=${booking.uid} email=${booking.attendeeEmail}`);

  try {
    if (trigger === 'BOOKING_CREATED' || trigger === 'BOOKING_RESCHEDULED') {
      if (!isLeadFollowUp(booking)) {
        sendBookingConfirmation(booking).catch((err) =>
          console.error('cal-webhook: confirm failed', err),
        );
        notifyBookingCreated(booking).catch((err) =>
          console.error('cal-webhook: notify failed', err),
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('cal-webhook:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
