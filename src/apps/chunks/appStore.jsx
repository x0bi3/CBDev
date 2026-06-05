import React, { useEffect, useState } from 'react';
import { useDevice } from '../../context/DeviceContext.jsx';
import { api, invalidateApiCache } from '../../lib/standaloneApi.js';
import { AppShell, Card } from '../appUi.jsx';

function launchLabel(type) {
  if (type === 'route') return 'Opens full screen';
  if (type === 'external') return 'External link';
  return 'In-app';
}

function actionLabel(app, busy) {
  if (busy) return '…';
  if (app.autoInstall) return 'Included';
  if (app.installed) return 'Remove';
  return 'Get';
}

function hasListing(app) {
  return !!(app.description || app.pricing || (app.features && app.features.length) || app.credits);
}

function ServiceDetail({ app, busy, onBack, onToggle }) {
  return (
    <AppShell title={app.label} subtitle={launchLabel(app.launchType)}>
      <button type="button" onClick={onBack}
        className="-mt-2 mb-1 flex items-center gap-1.5 text-[13px] font-medium text-white/70 transition hover:text-white active:scale-95">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        All services
      </button>
      <Card>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[30px] text-white"
            style={{ background: app.tile }}>{app.glyph}</div>
          <div className="min-w-0">
            <p className="text-[18px] font-semibold text-white">{app.label}</p>
            <p className="text-[12px] text-white/55">{launchLabel(app.launchType)}</p>
          </div>
        </div>
      </Card>
      {app.description && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">About</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/80">{app.description}</p>
        </Card>
      )}
      {app.pricing && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Pricing</p>
          <p className="mt-2 text-[15px] font-medium text-white">{app.pricing}</p>
        </Card>
      )}
      {app.features && app.features.length > 0 && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Features</p>
          <ul className="mt-2 space-y-2">
            {app.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {app.credits && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Credits</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">{app.credits}</p>
        </Card>
      )}
      {!hasListing(app) && (
        <Card>
          <p className="text-[14px] text-white/60">No listing details yet. Ask your admin for more info.</p>
        </Card>
      )}
      <button type="button" disabled={busy || app.autoInstall} onClick={() => onToggle(app)}
        className={'w-full rounded-2xl py-3.5 text-[15px] font-semibold transition active:scale-[0.98] ' +
          (app.installed || app.autoInstall
            ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-70'
            : 'bg-white text-black hover:bg-white/90')}>
        {actionLabel(app, busy)}
      </button>
    </AppShell>
  );
}

export default function AppStoreApp() {
  const { auth, openAuth, refreshHomeApps, closeAppAfterInstall } = useDevice();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(null);

  const loadStore = () => {
    setLoading(true);
    setErr(null);
    return api('/store/apps')
      .then((r) => {
        const next = r.apps || [];
        setApps(next);
        setSelected((prev) => (prev ? next.find((a) => a.id === prev.id) || null : null));
      })
      .catch((e) => setErr(e.message || 'Failed to load services'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth) return;
    loadStore();
  }, [auth]);

  const toggleInstall = async (app) => {
    if (app.autoInstall) return;
    setBusyId(app.id);
    setErr(null);
    try {
      if (app.installed) {
        await api(`/store/apps/${encodeURIComponent(app.id)}/uninstall`, { method: 'DELETE' });
        invalidateApiCache('user:');
        await refreshHomeApps();
        await loadStore();
      } else {
        await api(`/store/apps/${encodeURIComponent(app.id)}/install`, { method: 'POST' });
        invalidateApiCache('user:');
        await refreshHomeApps();
        closeAppAfterInstall(app.id);
      }
    } catch (e) {
      setErr(e.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!auth) {
    return (
      <AppShell title="Service Center" subtitle="Add services to your home screen.">
        <Card>
          <p className="text-[14px] leading-relaxed text-white/80">
            Sign in to browse services available for your account and add them to your home screen.
          </p>
          <button type="button" onClick={openAuth}
            className="mt-4 w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">
            Sign in to continue
          </button>
        </Card>
      </AppShell>
    );
  }

  if (selected) {
    return (
      <ServiceDetail
        app={selected}
        busy={busyId === selected.id}
        onBack={() => setSelected(null)}
        onToggle={toggleInstall}
      />
    );
  }

  return (
    <AppShell title="Service Center" subtitle="Add services to your home screen.">
      {loading && apps.length === 0 && (
        <Card><p className="text-[14px] text-white/60">Loading…</p></Card>
      )}
      {!loading && apps.length === 0 && !err && (
        <Card>
          <p className="text-[14px] text-white/70">No services available right now. Check back later or ask your admin for access.</p>
        </Card>
      )}
      {apps.map((app) => (
        <Card key={app.id}>
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => setSelected(app)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none transition active:opacity-80 focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl -m-1 p-1">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px] text-white"
                style={{ background: app.tile }}>{app.glyph}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-white">{app.label}</p>
                <p className="text-[12px] text-white/55">{launchLabel(app.launchType)}</p>
                {app.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/45">{app.description}</p>
                )}
              </div>
              <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button type="button" disabled={busyId === app.id || app.autoInstall}
              onClick={() => toggleInstall(app)}
              className={'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition active:scale-95 ' +
                (app.installed || app.autoInstall
                  ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-70'
                  : 'bg-white text-black hover:bg-white/90')}>
              {actionLabel(app, busyId === app.id)}
            </button>
          </div>
        </Card>
      ))}
      {err && <p className="text-[12px] text-rose-300 px-1">{err}</p>}
    </AppShell>
  );
}
