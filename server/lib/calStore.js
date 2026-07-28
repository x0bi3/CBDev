import pg from 'pg';

const { Pool } = pg;

let pool = null;

function calWebappUrl() {
  return (process.env.CAL_WEBAPP_URL || 'https://cal.creativebuilds.dev').replace(/\/$/, '');
}

function calUsername() {
  return process.env.CAL_USERNAME || 'x0bi3';
}

export function calConfigured() {
  return Boolean(process.env.CAL_DATABASE_URL);
}

function getPool() {
  if (!process.env.CAL_DATABASE_URL) {
    throw new Error('CAL_DATABASE_URL is not set — point it at the Cal.diy Postgres database');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.CAL_DATABASE_URL,
      max: 4,
      options: '-c timezone=UTC',
    });
    pool.on('error', (err) => {
      console.error('calStore: pool error', err);
    });
  }
  return pool;
}

function mapBooking(row) {
  const base = calWebappUrl();
  const username = calUsername();
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    description: row.description || '',
    status: row.status,
    start: row.startTime,
    end: row.endTime,
    location: row.location || '',
    paid: Boolean(row.paid),
    eventTypeId: row.eventTypeId,
    eventTypeTitle: row.event_type_title || null,
    eventTypeSlug: row.event_type_slug || null,
    attendees: row.attendees || [],
    hostEmail: row.host_email || null,
    hostName: row.host_name || null,
    links: {
      booking: `${base}/booking/${row.uid}`,
      cancel: `${base}/booking/${row.uid}?cancel=true`,
      reschedule: `${base}/reschedule/${row.uid}`,
      eventType: row.event_type_slug
        ? `${base}/${username}/${row.event_type_slug}`
        : null,
    },
  };
}

export async function listCalBookings({ from, to, status } = {}) {
  const params = [];
  const where = ['1=1'];
  if (from) {
    params.push(new Date(from).toISOString());
    where.push(`(b."startTime" AT TIME ZONE 'America/Chicago') >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(new Date(to).toISOString());
    where.push(`(b."startTime" AT TIME ZONE 'America/Chicago') < $${params.length}::timestamptz`);
  }
  if (status && status !== 'all') {
    params.push(String(status).toLowerCase());
    where.push(`lower(b.status::text) = $${params.length}`);
  }

  const { rows } = await getPool().query(
    `SELECT b.id, b.uid, b.title, b.description, b.status,
            (b."startTime" AT TIME ZONE 'America/Chicago') AS "startTime",
            (b."endTime" AT TIME ZONE 'America/Chicago') AS "endTime",
            b.location, b.paid, b."eventTypeId",
            et.title AS event_type_title, et.slug AS event_type_slug,
            u.email AS host_email, u.name AS host_name,
            COALESCE(
              (
                SELECT json_agg(json_build_object(
                  'name', a.name,
                  'email', a.email,
                  'timeZone', a."timeZone"
                ) ORDER BY a.id)
                FROM "Attendee" a
                WHERE a."bookingId" = b.id
              ),
              '[]'::json
            ) AS attendees
     FROM "Booking" b
     LEFT JOIN "EventType" et ON et.id = b."eventTypeId"
     LEFT JOIN users u ON u.id = b."userId"
     WHERE ${where.join(' AND ')}
     ORDER BY b."startTime" ASC
     LIMIT 500`,
    params,
  );
  return rows.map(mapBooking);
}

export async function listCalEventTypes() {
  const username = calUsername();
  const base = calWebappUrl();
  const { rows } = await getPool().query(
    `SELECT et.id, et.title, et.slug, et.length, et.hidden, et.description,
            u.username
     FROM "EventType" et
     LEFT JOIN users u ON u.id = et."userId"
     ORDER BY et.hidden ASC, et.id ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    lengthMinutes: r.length,
    hidden: Boolean(r.hidden),
    description: r.description || '',
    publicUrl: `${base}/${r.username || username}/${r.slug}`,
  }));
}

export function calManageLinks() {
  const base = calWebappUrl();
  const username = calUsername();
  return {
    webapp: base,
    bookings: `${base}/bookings/upcoming`,
    eventTypes: `${base}/event-types`,
    availability: `${base}/availability`,
    settings: `${base}/settings/my-account/profile`,
    publicProfile: `${base}/${username}`,
    introCall: `${base}/${username}/intro-call`,
    blitzCall: `${base}/${username}/blitz-call`,
  };
}

export async function getCalCalendarSummary() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [upcoming, eventTypes] = await Promise.all([
    listCalBookings({ from: now.toISOString() }),
    listCalEventTypes(),
  ]);
  const thisMonth = await listCalBookings({
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
  });
  return {
    configured: true,
    timezone: 'America/Chicago',
    manage: calManageLinks(),
    counts: {
      upcoming: upcoming.filter((b) => !['cancelled', 'rejected'].includes(String(b.status).toLowerCase())).length,
      thisMonth: thisMonth.length,
      eventTypes: eventTypes.filter((e) => !e.hidden).length,
    },
    eventTypes,
  };
}
