import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
const TZ = 'America/Chicago';

function mapType(row) {
  return {
    slug: row.slug,
    label: row.label,
    durationMinutes: row.duration_minutes,
    description: row.description,
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    type: row.meeting_type_slug,
    typeLabel: row.type_label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    notes: row.notes || '',
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get('/types', requireAuth, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, label, duration_minutes, description
       FROM meeting_types WHERE active = TRUE ORDER BY sort_order, id`,
    );
    res.json({ types: rows.map(mapType) });
  } catch (err) {
    console.error('calendar types:', err);
    res.status(500).json({ error: 'Failed to load meeting types' });
  }
});

router.get('/slots', requireAuth, async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const typeSlug = String(req.query.type || 'call').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      return;
    }

    const { rows: typeRows } = await query(
      `SELECT slug, duration_minutes FROM meeting_types WHERE slug = $1 AND active = TRUE`,
      [typeSlug],
    );
    const meetingType = typeRows[0];
    if (!meetingType) {
      res.status(404).json({ error: 'Meeting type not found' });
      return;
    }

    const durationMin = meetingType.duration_minutes;
    const { rows: settingsRows } = await query('SELECT * FROM availability_settings WHERE id = 1');
    const settings = settingsRows[0] || {
      timezone: TZ,
      weekday_start: '09:00',
      weekday_end: '17:00',
      slot_interval_minutes: 30,
      work_weekdays: [1, 2, 3, 4, 5],
      blocked_dates: [],
    };
    const tz = settings.timezone || TZ;

    const { rows } = await query(
      `WITH s AS (SELECT * FROM availability_settings WHERE id = 1),
       bounds AS (
         SELECT
           ($1::date::timestamp AT TIME ZONE (SELECT timezone FROM s)) AS day_start,
           (($1::date + 1)::date::timestamp AT TIME ZONE (SELECT timezone FROM s)) AS day_end
       ),
       candidates AS (
         SELECT gs AS starts_at
         FROM bounds, s,
         generate_series(
           (SELECT day_start + s.weekday_start FROM bounds, s),
           (SELECT day_start + s.weekday_end FROM bounds, s) - ($2::int * interval '1 minute'),
           ((SELECT slot_interval_minutes FROM s) || ' minutes')::interval
         ) AS gs
         WHERE extract(isodow FROM (gs AT TIME ZONE (SELECT timezone FROM s)))
           = ANY((SELECT work_weekdays FROM s))
           AND NOT ($1::date = ANY(COALESCE((SELECT blocked_dates FROM s), '{}')))
       )
       SELECT c.starts_at
       FROM candidates c
       WHERE c.starts_at >= now()
         AND c.starts_at < (SELECT day_end FROM bounds)
         AND NOT EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.status = 'confirmed'
             AND b.starts_at < c.starts_at + ($2::int * interval '1 minute')
             AND b.ends_at > c.starts_at
         )
       ORDER BY c.starts_at`,
      [date, durationMin],
    );

    const slots = rows.map((r) => {
      const d = new Date(r.starts_at);
      return {
        startsAt: r.starts_at,
        label: d.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    });

    res.json({ date, type: typeSlug, durationMinutes: durationMin, slots });
  } catch (err) {
    console.error('calendar slots:', err);
    res.status(500).json({ error: 'Failed to load availability' });
  }
});

router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT b.id, b.meeting_type_slug, mt.label AS type_label,
              b.starts_at, b.ends_at, b.notes, b.status, b.created_at
       FROM bookings b
       JOIN meeting_types mt ON mt.slug = b.meeting_type_slug
       WHERE b.user_id = $1 AND b.status = 'confirmed' AND b.starts_at >= now() - interval '1 day'
       ORDER BY b.starts_at ASC`,
      [req.userId],
    );
    res.json({ bookings: rows.map(mapBooking) });
  } catch (err) {
    console.error('calendar bookings list:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const typeSlug = String(req.body.type || req.body.meetingType || '').trim();
    const startsAt = String(req.body.startsAt || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    if (!typeSlug || !startsAt) {
      res.status(400).json({ error: 'Meeting type and start time required' });
      return;
    }

    const { rows: typeRows } = await query(
      `SELECT slug, duration_minutes FROM meeting_types WHERE slug = $1 AND active = TRUE`,
      [typeSlug],
    );
    const meetingType = typeRows[0];
    if (!meetingType) {
      res.status(404).json({ error: 'Meeting type not found' });
      return;
    }

    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) {
      res.status(400).json({ error: 'Invalid start time' });
      return;
    }
    if (start <= new Date()) {
      res.status(400).json({ error: 'Choose a future time slot' });
      return;
    }

    const end = new Date(start.getTime() + meetingType.duration_minutes * 60 * 1000);

    const { rows: conflict } = await query(
      `SELECT id FROM bookings
       WHERE status = 'confirmed'
         AND starts_at < $1 AND ends_at > $2
       LIMIT 1`,
      [end.toISOString(), start.toISOString()],
    );
    if (conflict[0]) {
      res.status(409).json({ error: 'That slot was just taken. Pick another time.' });
      return;
    }

    const { rows } = await query(
      `INSERT INTO bookings (user_id, meeting_type_slug, starts_at, ends_at, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, meeting_type_slug, starts_at, ends_at, notes, status, created_at`,
      [req.userId, typeSlug, start.toISOString(), end.toISOString(), notes],
    );

    const { rows: labelRows } = await query(
      `SELECT label FROM meeting_types WHERE slug = $1`,
      [typeSlug],
    );
    const booking = mapBooking({ ...rows[0], type_label: labelRows[0]?.label || typeSlug });

    res.status(201).json({ booking });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'That slot was just taken. Pick another time.' });
      return;
    }
    console.error('calendar booking create:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.delete('/bookings/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2 AND status = 'confirmed'
       RETURNING id`,
      [id, req.userId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('calendar booking cancel:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
