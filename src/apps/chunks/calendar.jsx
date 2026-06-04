import React, { useState, useEffect, useCallback } from 'react';
import { useDevice } from '../../context/DeviceContext.jsx';
import { api, apiCached, invalidateApiCache, API_CACHE_TTL } from '../../lib/standaloneApi.js';
import { AppShell, Card } from '../appUi.jsx';

const SCHEDULE_TZ = 'America/Chicago';

function nextWeekdayDates(count) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function formatScheduleWhen(iso) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: SCHEDULE_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CalendarApp() {
  const { auth, openAuth } = useDevice();
  const [step, setStep] = useState('type');
  const [types, setTypes] = useState([]);
  const [typeSlug, setTypeSlug] = useState('call');
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [booking, setBooking] = useState(null);
  const dates = React.useMemo(() => nextWeekdayDates(12), []);

  const loadUpcoming = useCallback((force = false) => {
    if (force) invalidateApiCache(`user:${auth?.id || 'anon'}:/calendar/bookings`);
    return apiCached('/calendar/bookings', {}, API_CACHE_TTL.calendarBookings, auth?.id)
      .then((r) => setUpcoming(r.bookings || []))
      .catch(() => {});
  }, [auth?.id]);

  useEffect(() => {
    if (!auth) return;
    apiCached('/calendar/types', {}, API_CACHE_TTL.calendarTypes, auth.id)
      .then((r) => {
        const list = r.types || [];
        setTypes(list);
        if (list[0]) setTypeSlug(list[0].slug);
      })
      .catch((e) => setErr(e.message));
    loadUpcoming();
  }, [auth, loadUpcoming]);

  useEffect(() => {
    if (!date || !typeSlug || step !== 'time') return;
    setLoading(true);
    setErr(null);
    api(`/calendar/slots?date=${date}&type=${encodeURIComponent(typeSlug)}`)
      .then((r) => { setSlots(r.slots || []); setSlot(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [date, typeSlug, step]);

  const selectedType = types.find((t) => t.slug === typeSlug);

  const submitBooking = async () => {
    if (!slot) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await api('/calendar/bookings', {
        method: 'POST',
        body: { type: typeSlug, startsAt: slot.startsAt, notes: notes.trim() || undefined },
      });
      setBooking(r.booking);
      setStep('done');
      loadUpcoming(true);
    } catch (e) {
      setErr(e.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (id) => {
    setLoading(true);
    setErr(null);
    try {
      await api(`/calendar/bookings/${id}`, { method: 'DELETE' });
      await loadUpcoming(true);
    } catch (e) {
      setErr(e.message || 'Cancel failed');
    } finally {
      setLoading(false);
    }
  };

  if (!auth) {
    return (
      <AppShell title="Calendar" subtitle="Schedule a call or meeting with Ryan.">
        <Card>
          <p className="text-[14px] leading-relaxed text-white/80">
            Sign in to see availability and book a discovery call or project meeting.
          </p>
          <button type="button" onClick={openAuth}
            className="mt-4 w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">
            Sign in to continue
          </button>
        </Card>
      </AppShell>
    );
  }

  if (step === 'done' && booking) {
    return (
      <AppShell title="Booked" subtitle="You're on the calendar.">
        <Card>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500/25 text-xl">✓</div>
            <div>
              <p className="text-[15px] font-semibold">{booking.typeLabel || selectedType?.label}</p>
              <p className="text-[13px] text-white/65">{formatScheduleWhen(booking.startsAt)} · {SCHEDULE_TZ.replace('_', ' ')}</p>
            </div>
          </div>
          {notes && <p className="mt-3 text-[13px] text-white/70">Note: {notes}</p>}
          <p className="mt-3 text-[12px] text-white/55">Confirmation details will follow by email. Reply to that thread if you need to reschedule.</p>
          <button type="button" onClick={() => { setStep('type'); setBooking(null); setSlot(null); setDate(null); }}
            className="mt-4 w-full rounded-2xl bg-white/10 py-3 text-[14px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/20">
            Book another
          </button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Calendar" subtitle="Schedule a call or meeting.">
      {upcoming.length > 0 && (
        <Card>
          <p className="text-[12px] uppercase tracking-wider text-white/50">Upcoming</p>
          <ul className="mt-2 space-y-2">
            {upcoming.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{b.typeLabel}</p>
                  <p className="text-[11px] text-white/60">{formatScheduleWhen(b.startsAt)}</p>
                </div>
                <button type="button" onClick={() => cancelBooking(b.id)} disabled={loading}
                  className="shrink-0 text-[11px] text-rose-300 hover:text-rose-200">Cancel</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'type' && (
        <Card>
          <p className="text-[12px] uppercase tracking-wider text-white/50">What do you need?</p>
          <div className="mt-3 flex flex-col gap-2">
            {types.map((t) => (
              <button key={t.slug} type="button" onClick={() => setTypeSlug(t.slug)}
                className={'rounded-2xl border px-4 py-3 text-left transition ' +
                  (typeSlug === t.slug ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5 hover:border-white/25')}>
                <p className="text-[14px] font-semibold">{t.label}</p>
                <p className="mt-0.5 text-[12px] text-white/60">{t.durationMinutes} min · {t.description}</p>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setStep('date'); setDate(dates[0] || null); }}
            className="mt-4 w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">
            Choose a date
          </button>
        </Card>
      )}

      {step === 'date' && (
        <Card>
          <p className="text-[12px] uppercase tracking-wider text-white/50">Pick a weekday</p>
          <p className="mt-1 text-[12px] text-white/55">Availability is shown in Central Time (Wisconsin).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dates.map((d) => {
              const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              });
              return (
                <button key={d} type="button" onClick={() => setDate(d)}
                  className={'rounded-xl px-3 py-2 text-[12px] font-medium transition ' +
                    (date === d ? 'bg-white text-black' : 'bg-white/10 text-white/80 ring-1 ring-white/15 hover:bg-white/20')}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStep('type')} className="flex-1 rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-white/80">Back</button>
            <button type="button" disabled={!date} onClick={() => setStep('time')}
              className="flex-[2] rounded-2xl bg-white py-3 text-[14px] font-semibold text-black disabled:opacity-50">Pick a time</button>
          </div>
        </Card>
      )}

      {step === 'time' && (
        <Card>
          <p className="text-[12px] uppercase tracking-wider text-white/50">Available times</p>
          <p className="mt-1 text-[13px] text-white/65">{selectedType?.label} · {date}</p>
          {loading ? (
            <p className="mt-4 text-[13px] text-white/55">Loading slots…</p>
          ) : slots.length === 0 ? (
            <p className="mt-4 text-[13px] text-white/55">No open slots this day. Try another date.</p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button key={s.startsAt} type="button" onClick={() => setSlot(s)}
                  className={'rounded-xl py-2.5 text-[13px] font-medium tabular-nums transition ' +
                    (slot?.startsAt === s.startsAt ? 'bg-white text-black' : 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20')}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStep('date')} className="flex-1 rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-white/80">Back</button>
            <button type="button" disabled={!slot} onClick={() => setStep('confirm')}
              className="flex-[2] rounded-2xl bg-white py-3 text-[14px] font-semibold text-black disabled:opacity-50">Continue</button>
          </div>
        </Card>
      )}

      {step === 'confirm' && slot && (
        <Card>
          <p className="text-[12px] uppercase tracking-wider text-white/50">Confirm</p>
          <p className="mt-2 text-[15px] font-semibold">{selectedType?.label}</p>
          <p className="text-[13px] text-white/65">{formatScheduleWhen(slot.startsAt)}</p>
          <label className="mt-4 block">
            <span className="mb-1 block text-[12px] font-medium text-white/70">Anything we should prepare? <span className="text-white/40">optional</span></span>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals, links, context…"
              className="w-full resize-none rounded-xl bg-white/10 px-3 py-2.5 text-[14px] text-white ring-1 ring-white/15 outline-none focus:ring-white/40" />
          </label>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setStep('time')} className="flex-1 rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-white/80">Back</button>
            <button type="button" disabled={loading} onClick={submitBooking}
              className="flex-[2] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-[14px] font-semibold text-white disabled:opacity-60">
              {loading ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </Card>
      )}

      {err && <p className="text-[12px] text-rose-300 px-1">{err}</p>}
    </AppShell>
  );
}
