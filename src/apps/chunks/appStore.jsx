import React, { useEffect, useState } from 'react';
import { useDevice } from '../../context/DeviceContext.jsx';
import { api, invalidateApiCache } from '../../lib/standaloneApi.js';
import { AppShell, Card } from '../appUi.jsx';

function launchLabel(type) {
  if (type === 'route') return 'Opens in browser';
  if (type === 'external') return 'External link';
  return 'In-app';
}

export default function AppStoreApp() {
  const { auth, openAuth, refreshHomeApps } = useDevice();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadStore = () => {
    setLoading(true);
    setErr(null);
    return api('/store/apps')
      .then((r) => setApps(r.apps || []))
      .catch((e) => setErr(e.message || 'Failed to load store'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!auth) return;
    loadStore();
  }, [auth]);

  const toggleInstall = async (app) => {
    setBusyId(app.id);
    setErr(null);
    try {
      if (app.installed) {
        await api(`/store/apps/${encodeURIComponent(app.id)}/uninstall`, { method: 'DELETE' });
      } else {
        await api(`/store/apps/${encodeURIComponent(app.id)}/install`, { method: 'POST' });
      }
      invalidateApiCache('user:');
      await refreshHomeApps();
      await loadStore();
    } catch (e) {
      setErr(e.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!auth) {
    return (
      <AppShell title="App Store" subtitle="Install apps on your home screen.">
        <Card>
          <p className="text-[14px] leading-relaxed text-white/80">
            Sign in to browse apps available for your account and add them to your home screen.
          </p>
          <button type="button" onClick={openAuth}
            className="mt-4 w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">
            Sign in to continue
          </button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="App Store" subtitle="Get apps for your home screen.">
      {loading && apps.length === 0 && (
        <Card><p className="text-[14px] text-white/60">Loading…</p></Card>
      )}
      {!loading && apps.length === 0 && !err && (
        <Card>
          <p className="text-[14px] text-white/70">No apps available right now. Check back later or ask your admin for access.</p>
        </Card>
      )}
      {apps.map((app) => (
        <Card key={app.id}>
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[26px] text-white"
              style={{ background: app.tile }}>{app.glyph}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold text-white">{app.label}</p>
              <p className="text-[12px] text-white/55">{launchLabel(app.launchType)}</p>
            </div>
            <button type="button" disabled={busyId === app.id || app.autoInstall}
              onClick={() => toggleInstall(app)}
              className={'shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition active:scale-95 ' +
                (app.installed
                  ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15'
                  : 'bg-white text-black hover:bg-white/90')}>
              {busyId === app.id ? '…' : app.installed ? 'Remove' : 'Get'}
            </button>
          </div>
        </Card>
      ))}
      {err && <p className="text-[12px] text-rose-300 px-1">{err}</p>}
    </AppShell>
  );
}
