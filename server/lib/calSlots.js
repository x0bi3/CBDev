import pg from 'pg';

const { Pool } = pg;
const TZ = 'America/Chicago';

let pool = null;

function getPool() {
  if (!process.env.CAL_DATABASE_URL) {
    throw new Error('CAL_DATABASE_URL is not set');
  }
  if (!pool) {
    // Cal stores Booking times as timestamp-without-tz in UTC wall clock.
    // Force UTC so node-pg does not shift them by America/Chicago.
    pool = new Pool({
      connectionString: process.env.CAL_DATABASE_URL,
      max: 4,
      options: '-c timezone=UTC',
    });
    pool.on('error', (err) => console.error('calSlots: pool error', err));
  }
  return pool;
}

function introEventTypeId() {
  return Number(process.env.CAL_INTRO_EVENT_TYPE_ID || 2);
}

/** Parse Postgres time / Date into minutes from midnight. */
function timeToMinutes(value) {
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  const s = String(value);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Convert America/Chicago wall time Y-M-D H:M to UTC Date. */
function chicagoWallToUtc(ymd, hour, minute) {
  const guess = new Date(`${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const gotMin = Number(parts.hour) * 60 + Number(parts.minute);
  const wantMin = hour * 60 + minute;
  guess.setUTCMinutes(guess.getUTCMinutes() + (wantMin - gotMin));
  // Re-check day drift
  const parts2 = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const gotYmd = `${parts2.year}-${parts2.month}-${parts2.day}`;
  if (gotYmd !== ymd) {
    const dayDelta = gotYmd < ymd ? 1 : -1;
    guess.setUTCDate(guess.getUTCDate() + dayDelta);
  }
  return guess;
}

function chicagoParts(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

function weekdayIndex(short) {
  // Cal Availability.days: 0=Sunday … 6=Saturday
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[short] ?? 0;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function labelSlot(trueUtc) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(trueUtc);
}

/**
 * Cal.diy stores Booking start/end as timestamp-without-tz and the UI shows that
 * clock as America/Chicago. Send Chicago wall time stamped with Z so Cal stores
 * the same numbers the UI displays (e.g. 10:00 AM CT → …T10:00:00.000Z).
 */
export function toCalWallStartIso(trueUtc) {
  const p = chicagoParts(trueUtc);
  let hour = Number(p.hour);
  if (hour === 24) hour = 0;
  return `${p.year}-${p.month}-${p.day}T${String(hour).padStart(2, '0')}:${p.minute}:00.000Z`;
}

/**
 * List open Intro Call slots from Cal.diy Schedule + Availability minus bookings.
 */
export async function listIntroSlots({ from, to, limit = 12 } = {}) {
  const eventTypeId = introEventTypeId();
  const db = getPool();

  const etRes = await db.query(
    `SELECT id, length, "minimumBookingNotice", "slotInterval", "scheduleId", "userId"
     FROM "EventType" WHERE id = $1`,
    [eventTypeId],
  );
  const et = etRes.rows[0];
  if (!et) throw new Error(`Event type ${eventTypeId} not found in Cal.diy`);

  const lengthMin = Number(et.length) || 30;
  const noticeMin = Number(et.minimumBookingNotice) || 120;
  const intervalMin = Number(et.slotInterval) || lengthMin;
  const userId = et.userId;

  let scheduleId = et.scheduleId;
  if (!scheduleId) {
    const s = await db.query(
      `SELECT id FROM "Schedule" WHERE "userId" = $1 ORDER BY id ASC LIMIT 1`,
      [userId],
    );
    scheduleId = s.rows[0]?.id;
  }
  if (!scheduleId) throw new Error('No Cal.diy schedule found for host');

  const availRes = await db.query(
    `SELECT days, "startTime", "endTime", date
     FROM "Availability"
     WHERE "scheduleId" = $1`,
    [scheduleId],
  );

  const now = new Date();
  const rangeStart = from ? new Date(from) : now;
  const rangeEnd = to
    ? new Date(to)
    : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const earliest = new Date(now.getTime() + noticeMin * 60 * 1000);

  // Naive Booking clocks are America/Chicago wall times in this Cal.diy install.
  const busyRes = await db.query(
    `SELECT ("startTime" AT TIME ZONE 'America/Chicago') AS "startTime",
            ("endTime" AT TIME ZONE 'America/Chicago') AS "endTime"
     FROM "Booking"
     WHERE "userId" = $1
       AND lower(status::text) NOT IN ('cancelled', 'rejected')
       AND ("startTime" AT TIME ZONE 'America/Chicago') < $3::timestamptz
       AND ("endTime" AT TIME ZONE 'America/Chicago') > $2::timestamptz`,
    [userId, rangeStart.toISOString(), rangeEnd.toISOString()],
  );
  const busy = busyRes.rows.map((r) => ({
    start: new Date(r.startTime),
    end: new Date(r.endTime),
  }));

  const slots = [];
  const cursor = new Date(rangeStart);
  cursor.setUTCHours(12, 0, 0, 0);

  for (let day = 0; day < 21 && slots.length < limit; day++) {
    const dayDate = new Date(cursor.getTime() + day * 24 * 60 * 60 * 1000);
    const parts = chicagoParts(dayDate);
    const ymd = `${parts.year}-${parts.month}-${parts.day}`;
    const dow = weekdayIndex(parts.weekday);

    const windows = availRes.rows.filter((row) => {
      if (row.date) {
        const d = new Date(row.date);
        const dp = chicagoParts(d);
        return `${dp.year}-${dp.month}-${dp.day}` === ymd;
      }
      const days = row.days || [];
      return days.includes(dow);
    });

    for (const win of windows) {
      const startM = timeToMinutes(win.startTime);
      const endM = timeToMinutes(win.endTime);
      for (let m = startM; m + lengthMin <= endM; m += intervalMin) {
        const hour = Math.floor(m / 60);
        const minute = m % 60;
        const slotStart = chicagoWallToUtc(ymd, hour, minute);
        const slotEnd = new Date(slotStart.getTime() + lengthMin * 60 * 1000);
        if (slotStart < earliest || slotStart < rangeStart || slotStart >= rangeEnd) continue;
        if (busy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end))) continue;
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          label: labelSlot(slotStart),
          timeZone: TZ,
          durationMinutes: lengthMin,
          eventTypeId,
        });
        if (slots.length >= limit) break;
      }
      if (slots.length >= limit) break;
    }
  }

  return {
    eventTypeId,
    eventTypeSlug: 'intro-call',
    timeZone: TZ,
    slots,
  };
}

/**
 * Cal.diy UI shows naive timestamp clocks as local CT. After a successful book
 * (which stores UTC clock components), rewrite start/end to Chicago wall times
 * so the Cal dashboard matches what Miranda said.
 */
export async function alignBookingTimesToChicagoWall(uid, trueUtcStart, lengthMin = 30) {
  if (!process.env.CAL_DATABASE_URL || !uid) return false;
  const start = trueUtcStart instanceof Date ? trueUtcStart : new Date(trueUtcStart);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + lengthMin * 60 * 1000);
  const startWall = toCalWallStartIso(start).replace('T', ' ').replace('.000Z', '');
  const endWall = toCalWallStartIso(end).replace('T', ' ').replace('.000Z', '');
  const db = getPool();
  const res = await db.query(
    `UPDATE "Booking"
     SET "startTime" = $2::timestamp,
         "endTime" = $3::timestamp,
         "updatedAt" = NOW()
     WHERE uid = $1
     RETURNING uid, "startTime"::text AS start_txt, "endTime"::text AS end_txt`,
    [String(uid), startWall, endWall],
  );
  if (res.rowCount) {
    console.log(
      `calSlots: aligned ${uid} to wall ${res.rows[0].start_txt} – ${res.rows[0].end_txt}`,
    );
  }
  return res.rowCount > 0;
}

/**
 * Cal sometimes leaves idempotencyKey on cancelled bookings. That blocks rebooking
 * the same start/end (P2002 on Booking_idempotencyKey_key).
 */
export async function clearStaleIntroIdempotency(startIso) {
  if (!process.env.CAL_DATABASE_URL) return 0;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 0;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const db = getPool();
  const res = await db.query(
    `UPDATE "Booking"
     SET "idempotencyKey" = NULL
     WHERE "eventTypeId" = $1
       AND lower(status::text) IN ('cancelled', 'rejected')
       AND "idempotencyKey" IS NOT NULL
       AND ("startTime" AT TIME ZONE 'America/Chicago') < $3::timestamptz
       AND ("endTime" AT TIME ZONE 'America/Chicago') > $2::timestamptz
     RETURNING id`,
    [introEventTypeId(), start.toISOString(), end.toISOString()],
  );
  // Also clear any cancelled leftovers globally (cheap safety net).
  const all = await db.query(
    `UPDATE "Booking"
     SET "idempotencyKey" = NULL
     WHERE lower(status::text) IN ('cancelled', 'rejected')
       AND "idempotencyKey" IS NOT NULL
     RETURNING id`,
  );
  const n = (res.rowCount || 0) + (all.rowCount || 0);
  if (n) console.log(`calSlots: cleared ${n} stale idempotency key(s)`);
  return n;
}
