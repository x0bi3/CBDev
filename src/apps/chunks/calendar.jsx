import React from 'react';
import { AppShell, Card } from '../appUi.jsx';

const CAL_BASE = 'https://cal.creativebuilds.dev';
const CAL_USER = 'x0bi3';

/** Legacy in-app booking UI retired — scheduling lives in Cal.diy. */
export default function CalendarApp() {
  return (
    <AppShell title="Calendar" subtitle="Book time with Ryan on Cal.diy.">
      <Card className="space-y-4 p-4 text-center">
        <p className="text-sm text-white/70">
          Scheduling is powered by Cal.diy. Pick a call type below — availability syncs from Ryan&apos;s live calendar.
        </p>
        <a
          href={`${CAL_BASE}/${CAL_USER}/intro-call`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-white/15 px-4 py-3 font-medium hover:bg-white/25"
        >
          Book intro call
        </a>
        <a
          href={`${CAL_BASE}/${CAL_USER}/blitz-call`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-white/20 px-4 py-3 font-medium hover:bg-white/10"
        >
          Book Blitz Call
        </a>
        <a
          href={`${CAL_BASE}/${CAL_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-sky-300 hover:underline"
        >
          Open full Cal.diy profile ↗
        </a>
      </Card>
    </AppShell>
  );
}
