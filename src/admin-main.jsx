import './admin.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

const TOKEN_KEY = 'cb-admin-token';

async function api(path, opts = {}) {
  const { method = 'GET', body, auth = true } = opts;
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (auth !== false && token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@creativebuilds.dev');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      if (r.user?.role !== 'admin') throw new Error('This account is not an admin.');
      localStorage.setItem(TOKEN_KEY, r.token);
      onLogin(r.user);
    } catch (ex) {
      setErr(ex.message);
    }
  };
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold">CreativeBuilds Admin</h1>
        <p className="mt-1 text-sm text-slate-400">creativeadmin.cyberopticsoftware.com</p>
        <label className="mt-6 block text-sm text-slate-300">Email</label>
        <input className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        <label className="mt-4 block text-sm text-slate-300">Password</label>
        <input className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" value={password} onChange={e => setPassword(e.target.value)} type="password" required />
        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}
        <button type="submit" className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 font-semibold hover:bg-indigo-500">Sign in</button>
      </form>
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', className = '' }) {
  const base = 'rounded-lg px-3 py-1.5 text-sm font-medium transition ';
  const styles = variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : variant === 'ghost' ? 'border border-slate-600 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-500';
  return <button type="button" onClick={onClick} className={base + styles + ' ' + className}>{children}</button>;
}

function Table({ columns, rows, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
          <tr>{columns.map(c => <th key={c.key} className="px-4 py-3">{c.label}</th>)}<th className="px-4 py-3">Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id || row.slug || row.app_id} className="border-t border-slate-700/80 hover:bg-slate-800/40">
              {columns.map(c => <td key={c.key} className="max-w-xs truncate px-4 py-2.5">{c.render ? c.render(row) : row[c.key]}</td>)}
              <td className="px-4 py-2.5 whitespace-nowrap">
                <Btn variant="ghost" onClick={() => onEdit(row)}>Edit</Btn>
                <Btn variant="danger" className="ml-2" onClick={() => onDelete(row)}>Delete</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-medium text-slate-300">{label}</span><div className="mt-1">{children}</div></label>;
}

function inputCls(extra = '') {
  return 'w-full rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 ' + extra;
}

function modalPanelCls(wide = false) {
  return 'max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-500 bg-slate-800 p-6 text-slate-100 shadow-2xl ' +
    (wide ? 'max-w-2xl' : 'max-w-lg');
}

async function uploadProductImage(file) {
  const token = localStorage.getItem(TOKEN_KEY);
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/admin/uploads/product-image', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    body: fd,
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}

function variantsToRows(variants) {
  if (!variants || typeof variants !== 'object') return [];
  return Object.entries(variants).map(([name, options]) => ({
    name,
    options: Array.isArray(options) ? options.map(String) : [],
  }));
}

function rowsToVariants(rows) {
  const out = {};
  for (const row of rows || []) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const opts = (row.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (opts.length) out[name] = opts;
  }
  return out;
}

function VariantsEditor({ rows, onChange }) {
  const updateRow = (i, patch) => {
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => onChange([...rows, { name: '', options: [] }]);
  const removeRow = (i) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-500">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/90 text-left text-xs uppercase tracking-wide text-slate-300">
          <tr>
            <th className="px-3 py-2.5 font-medium">Option group</th>
            <th className="px-3 py-2.5 font-medium">Choices</th>
            <th className="w-12 px-2 py-2.5" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-5 text-center text-slate-400">
                No size/color options — shoppers get one default choice.
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-600 bg-slate-900/40">
              <td className="px-3 py-2 align-top">
                <input
                  className={inputCls()}
                  placeholder="Size"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  className={inputCls()}
                  placeholder="XS, S, M, L, XL"
                  value={row.options.join(', ')}
                  onChange={(e) => updateRow(i, {
                    options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })}
                />
                {row.options.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.options.map((opt, k) => (
                      <span key={k} className="rounded-md bg-slate-700 px-2 py-0.5 text-xs text-slate-200">{opt}</span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-2 py-2 align-top text-center">
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded px-2 py-1 text-lg leading-none text-rose-400 hover:bg-rose-950 hover:text-rose-300"
                  title="Remove group"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-slate-600 bg-slate-900/60 px-3 py-2">
        <Btn variant="ghost" onClick={addRow}>+ Add option group</Btn>
        <span className="text-xs text-slate-400">Comma-separated values</span>
      </div>
    </div>
  );
}

function ProductImagesEditor({ images, onImagesChange }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const list = Array.isArray(images) ? images : [];

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      onImagesChange([...list, url]);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {list.map((src, i) => (
          <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-500 bg-slate-900">
            {src.startsWith('/') || src.startsWith('http') ? (
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className={'h-full w-full bg-gradient-to-br ' + src} title="Gradient placeholder" />
            )}
            <button type="button" onClick={() => onImagesChange(list.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-xs text-white hover:bg-rose-600">×</button>
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-500 bg-slate-900/80 text-center text-[10px] text-slate-300 hover:border-indigo-400 hover:text-white">
          {uploading ? '…' : '+ Upload'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onPick} disabled={uploading} />
        </label>
      </div>
      <p className="text-xs text-slate-400">Upload product photos (JPEG, PNG, WebP, or GIF, up to 8MB).</p>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  );
}

function ProductsSection() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/products').then(r => setRows(r.products));
  useEffect(() => { load(); }, []);

  const openEdit = (row) => {
    if (!row) {
      setEdit({
        name: '', category_slug: 'apparel', price_cents: 0, color: 'from-indigo-500 to-violet-700',
        description: '', images: [], variantRows: [], active: true, track_inventory: false, stock_quantity: 0, sku: '',
      });
      return;
    }
    setEdit({
      ...row,
      images: Array.isArray(row.images) ? [...row.images] : [],
      variantRows: variantsToRows(row.variants),
      stock_quantity: row.stock_quantity ?? 0,
      track_inventory: !!row.track_inventory,
    });
  };

  const save = async () => {
    const body = {
      ...edit,
      price_cents: Math.round(Number(edit.price_cents) || 0),
      images: edit.images || [],
      variants: rowsToVariants(edit.variantRows),
      stock_quantity: Math.max(0, Number(edit.stock_quantity) || 0),
      track_inventory: !!edit.track_inventory,
    };
    delete body.variantRows;
    if (edit.id) await api('/admin/products/' + edit.id, { method: 'PUT', body });
    else await api('/admin/products', { method: 'POST', body });
    setEdit(null);
    load();
  };

  const stockLabel = (r) => {
    if (!r.track_inventory) return '—';
    const n = r.stock_quantity ?? 0;
    return n <= 0 ? 'Out of stock' : String(n);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Products</h2>
        <Btn onClick={() => openEdit(null)}>Add product</Btn>
      </div>
      <Table
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'category_slug', label: 'Category' },
          { key: 'price_cents', label: 'Price', render: r => '£' + (r.price_cents / 100).toFixed(2) },
          { key: 'stock', label: 'Stock', render: stockLabel },
          { key: 'active', label: 'Active', render: r => r.active ? 'Yes' : 'No' },
        ]}
        rows={rows}
        onEdit={openEdit}
        onDelete={async r => { if (confirm('Delete?')) { await api('/admin/products/' + r.id, { method: 'DELETE' }); load(); } }}
      />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setEdit(null)}>
          <div className={modalPanelCls(true)} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white">{edit.id ? 'Edit' : 'New'} product</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Name"><input className={inputCls()} value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Slug"><input className={inputCls()} value={edit.slug || ''} onChange={e => setEdit({ ...edit, slug: e.target.value })} /></Field>
              <Field label="SKU (optional)"><input className={inputCls()} value={edit.sku || ''} onChange={e => setEdit({ ...edit, sku: e.target.value })} /></Field>
              <Field label="Category slug"><input className={inputCls()} value={edit.category_slug || ''} onChange={e => setEdit({ ...edit, category_slug: e.target.value })} /></Field>
              <Field label="Price (pence)"><input type="number" className={inputCls()} value={edit.price_cents || 0} onChange={e => setEdit({ ...edit, price_cents: Number(e.target.value) })} /></Field>
              <Field label="Fallback color gradient (no photo)"><input className={inputCls()} value={edit.color || ''} onChange={e => setEdit({ ...edit, color: e.target.value })} placeholder="from-rose-500 to-red-800" /></Field>
              <Field label="Description"><textarea className={inputCls()} rows={3} value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Product images">
                <ProductImagesEditor images={edit.images} onImagesChange={imgs => setEdit({ ...edit, images: imgs })} />
              </Field>
              <div className="rounded-lg border border-slate-500 bg-slate-900/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Inventory</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={!!edit.track_inventory} onChange={e => setEdit({ ...edit, track_inventory: e.target.checked })} />
                  Track stock for this product
                </label>
                {edit.track_inventory && (
                  <Field label="Quantity in stock">
                    <input type="number" min={0} className={inputCls()} value={edit.stock_quantity ?? 0}
                      onChange={e => setEdit({ ...edit, stock_quantity: Math.max(0, Number(e.target.value)) })} />
                  </Field>
                )}
              </div>
              <Field label="Variants (sizes, colors, etc.)">
                <VariantsEditor
                  rows={edit.variantRows || []}
                  onChange={(variantRows) => setEdit({ ...edit, variantRows })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({ ...edit, active: e.target.checked })} />
                Active (visible in Merch store)
              </label>
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

const AGENT_STATE_STYLES = {
  idle: 'bg-slate-700 text-slate-200',
  queued: 'bg-amber-900/60 text-amber-200',
  running: 'bg-emerald-900/60 text-emerald-200',
  paused: 'bg-orange-900/60 text-orange-200',
};

function BlogAgentsSection() {
  const [agents, setAgents] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [runs, setRuns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const logListRef = useRef(null);
  const lastLogIdRef = useRef(null);

  const loadHistory = useCallback(async (agentId, runId) => {
    if (!agentId) return;
    const logsPath = runId
      ? `/admin/blog-agents/${agentId}/logs?limit=80&run_id=${runId}`
      : `/admin/blog-agents/${agentId}/logs?limit=80`;
    const [r, l] = await Promise.all([
      api('/admin/blog-agents/' + agentId + '/runs?limit=15'),
      api(logsPath),
    ]);
    setRuns(r.runs);
    const newestId = l.logs[l.logs.length - 1]?.id ?? null;
    if (newestId === lastLogIdRef.current) return;
    lastLogIdRef.current = newestId;
    setLogs(l.logs);
    requestAnimationFrame(() => {
      const el = logListRef.current;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const refreshAgents = useCallback(async () => {
    const r = await api('/admin/blog-agents');
    setAgents(r.agents);
    return r.agents;
  }, []);

  const refresh = useCallback(async () => {
    const list = await refreshAgents();
    if (expanded) {
      const agent = list.find((a) => a.id === expanded);
      const runId = agent?.is_active ? agent.active_run_id : null;
      await loadHistory(expanded, runId);
    }
  }, [expanded, loadHistory, refreshAgents]);

  useEffect(() => {
    refreshAgents().catch((ex) => setErr(ex.message));
  }, [refreshAgents]);

  const anyLive = agents.some((a) => a.is_active);

  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(() => {
      refresh().catch((ex) => setErr(ex.message));
    }, 3000);
    return () => clearInterval(t);
  }, [anyLive, refresh]);

  const openHistory = async (agent) => {
    if (expanded === agent.id) {
      setExpanded(null);
      lastLogIdRef.current = null;
      return;
    }
    setExpanded(agent.id);
    lastLogIdRef.current = null;
    try {
      const runId = agent.is_active ? agent.active_run_id : null;
      await loadHistory(agent.id, runId);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const act = async (agentId, action) => {
    setBusy(agentId + ':' + action);
    setErr('');
    try {
      if (action === 'start') setExpanded(agentId);
      await api('/admin/blog-agents/' + agentId + '/' + action, { method: 'POST' });
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async (agent) => {
    setBusy('save:' + agent.id);
    setErr('');
    try {
      await api('/admin/blog-agents/' + agent.id, {
        method: 'PUT',
        body: {
          enabled: agent._enabled,
          schedule_interval_minutes: agent._interval === '' ? null : Number(agent._interval),
          config: JSON.parse(agent._configJson || '{}'),
        },
      });
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(null);
    }
  };

  const deleteAgent = async (agent) => {
    if (!confirm(`Delete "${agent.name}"? Run history will also be removed.`)) return;
    setBusy('delete:' + agent.id);
    setErr('');
    try {
      await api('/admin/blog-agents/' + agent.id, { method: 'DELETE' });
      if (expanded === agent.id) setExpanded(null);
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(null);
    }
  };

  const resetAgent = async (agent) => {
    setBusy('reset:' + agent.id);
    setErr('');
    try {
      await api('/admin/blog-agents/' + agent.id + '/reset', { method: 'POST' });
      await refreshAgents();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(null);
    }
  };

  const patchLocal = (id, patch) => {
    setAgents((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">Blog writing agents</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">
        Run and monitor automated blog pipelines. Implement logic in <code className="text-indigo-300">server/agents/</code> — each module exports a default async function that reports steps via <code className="text-indigo-300">ctx.step()</code>.
      </p>
      {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

      <div className="mt-6 space-y-4">
        {agents.map((agent) => {
          const live = agent.is_active;
          const stale = !live && ['running', 'paused', 'queued'].includes(agent.run_state);
          const paused = live && agent.run_state === 'paused';
          const enabled = agent._enabled !== undefined ? agent._enabled : agent.enabled;
          const interval = agent._interval !== undefined ? agent._interval : (agent.schedule_interval_minutes ?? '');
          const configJson = agent._configJson !== undefined ? agent._configJson : JSON.stringify(agent.config || {}, null, 2);
          const liveLabel = stale
            ? `${agent.name} — interrupted (stale — server lost track of this run)`
            : agent.status_message
              ? `${agent.name} — ${agent.status_message}`
              : `${agent.name} — idle`;

          return (
            <div key={agent.id} className="rounded-xl border border-slate-600 bg-slate-900/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-50">{agent.name}</h3>
                    <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ' + (stale ? AGENT_STATE_STYLES.idle : (AGENT_STATE_STYLES[agent.run_state] || AGENT_STATE_STYLES.idle))}>
                      {stale ? 'stale' : agent.run_state}
                    </span>
                    {agent.enabled && <span className="text-xs text-indigo-300">scheduled</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{agent.description}</p>
                  <p className={'mt-2 font-mono text-sm ' + (stale ? 'text-amber-300/90' : 'text-emerald-300/90')}>{liveLabel}</p>
                  {agent.current_step && live && (
                    <p className="mt-1 text-xs text-slate-500">Step: {agent.current_step}</p>
                  )}
                  {live && (
                    <p className="mt-1 text-xs text-emerald-400">● Live — status refreshes every 3s. Draft/analysis may take 30–90s with no new log lines.</p>
                  )}
                  {agent.last_error && (
                    <p className="mt-2 text-sm text-rose-400">Last error: {agent.last_error}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Script: server/agents/{agent.script_module}.js
                    {agent.last_run_at && ' · Last run ' + new Date(agent.last_run_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!live && !stale && (
                    <Btn onClick={() => act(agent.id, 'start')} disabled={!!busy}>
                      Start
                    </Btn>
                  )}
                  {stale && (
                    <Btn variant="danger" onClick={() => resetAgent(agent)} disabled={!!busy}>
                      Reset
                    </Btn>
                  )}
                  {live && !paused && (
                    <Btn variant="ghost" onClick={() => act(agent.id, 'pause')} disabled={!!busy}>
                      Pause
                    </Btn>
                  )}
                  {live && paused && (
                    <Btn onClick={() => act(agent.id, 'resume')} disabled={!!busy}>
                      Resume
                    </Btn>
                  )}
                  {live && (
                    <Btn variant="danger" onClick={() => act(agent.id, 'stop')} disabled={!!busy}>
                      Stop
                    </Btn>
                  )}
                  <Btn variant="ghost" onClick={() => openHistory(agent)}>
                    {expanded === agent.id ? 'Hide log' : 'History'}
                  </Btn>
                  {!live && !stale && (
                    <Btn variant="danger" onClick={() => deleteAgent(agent)} disabled={!!busy}>
                      Delete
                    </Btn>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-700/80 pt-4 sm:grid-cols-3">
                <Field label="Auto-run on schedule">
                  <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={!!enabled}
                      onChange={(e) => patchLocal(agent.id, { _enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </Field>
                <Field label="Interval (minutes)">
                  <input
                    className={inputCls()}
                    type="number"
                    min="0"
                    placeholder="Manual only"
                    value={interval}
                    onChange={(e) => patchLocal(agent.id, { _interval: e.target.value })}
                  />
                </Field>
                <Field label="Config JSON">
                  <textarea
                    className={inputCls('font-mono text-xs')}
                    rows={2}
                    value={configJson}
                    onChange={(e) => patchLocal(agent.id, { _configJson: e.target.value })}
                  />
                </Field>
              </div>
              <div className="mt-2">
                <Btn variant="ghost" onClick={() => saveSettings({ ...agent, _enabled: enabled, _interval: interval, _configJson: configJson })} disabled={!!busy}>
                  Save schedule & config
                </Btn>
              </div>

              {expanded === agent.id && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Recent runs</h4>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
                      {runs.map((run) => (
                        <li key={run.id} className="rounded border border-slate-700/80 px-2 py-1.5">
                          <span className="text-slate-200">#{run.id}</span> {run.status} · {run.trigger}
                          {run.status_message && ' — ' + run.status_message}
                          <span className="block text-slate-500">{new Date(run.created_at).toLocaleString()}</span>
                        </li>
                      ))}
                      {runs.length === 0 && <li className="text-slate-500">No runs yet</li>}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Step log</h4>
                    <ul ref={logListRef} className="mt-2 max-h-48 space-y-1 overflow-y-auto font-mono text-xs">
                      {logs.map((log) => (
                        <li key={log.id} className={'rounded px-2 py-1 ' + (log.level === 'error' ? 'text-rose-300' : 'text-slate-400')}>
                          [{new Date(log.created_at).toLocaleTimeString()}]
                          {log.step ? ` ${log.step}:` : ''} {log.message}
                        </li>
                      ))}
                      {logs.length === 0 && <li className="text-slate-500">No log lines yet</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {agents.length === 0 && (
          <p className="text-sm text-slate-500">No agents registered. Run migration 009_blog_agents.sql.</p>
        )}
      </div>
    </div>
  );
}

function BlogSection() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/blog').then(r => setRows(r.posts));
  useEffect(() => { load(); }, []);
  const save = async () => {
    const body = { ...edit, body: JSON.parse(edit.bodyJson || '[]'), published_at: edit.published_at || null };
    if (edit.id) await api('/admin/blog/' + edit.id, { method: 'PUT', body });
    else await api('/admin/blog', { method: 'POST', body });
    setEdit(null); load();
  };
  return (
    <div>
      <div className="mb-4 flex justify-between"><h2 className="text-xl font-semibold">Blog</h2><Btn onClick={() => setEdit({ title:'', status:'draft', bodyJson:'[]', read_time:'5 min' })}>Add post</Btn></div>
      <Table columns={[{key:'title',label:'Title'},{key:'status',label:'Status'},{key:'published_at',label:'Published',render:r=>r.published_at?new Date(r.published_at).toLocaleDateString():'—'}]} rows={rows} onEdit={r=>setEdit({...r,bodyJson:JSON.stringify(r.body||[],null,2),published_at:r.published_at?r.published_at.slice(0,16):''})} onDelete={async r=>{if(confirm('Delete?')){await api('/admin/blog/'+r.id,{method:'DELETE'});load();}}} />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{edit.id?'Edit':'New'} post</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Title"><input className={inputCls()} value={edit.title||''} onChange={e=>setEdit({...edit,title:e.target.value})} /></Field>
              <Field label="Slug"><input className={inputCls()} value={edit.slug||''} onChange={e=>setEdit({...edit,slug:e.target.value})} /></Field>
              <Field label="Status"><select className={inputCls()} value={edit.status||'draft'} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="draft">draft</option><option value="published">published</option></select></Field>
              <Field label="Publish at (local)"><input type="datetime-local" className={inputCls()} value={edit.published_at||''} onChange={e=>setEdit({...edit,published_at:e.target.value?new Date(e.target.value).toISOString():null})} /></Field>
              <Field label="Read time"><input className={inputCls()} value={edit.read_time||''} onChange={e=>setEdit({...edit,read_time:e.target.value})} /></Field>
              <Field label="Excerpt"><textarea className={inputCls()} rows={2} value={edit.excerpt||''} onChange={e=>setEdit({...edit,excerpt:e.target.value})} /></Field>
              <Field label="Body paragraphs JSON"><textarea className={inputCls('font-mono text-xs')} rows={6} value={edit.bodyJson||'[]'} onChange={e=>setEdit({...edit,bodyJson:e.target.value})} /></Field>
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioSection() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/portfolio').then(r => setRows(r.projects));
  useEffect(() => { load(); }, []);
  const save = async () => {
    const body = { ...edit, highlights: JSON.parse(edit.highlightsJson || '[]') };
    if (edit.id) await api('/admin/portfolio/' + edit.id, { method: 'PUT', body });
    else await api('/admin/portfolio', { method: 'POST', body });
    setEdit(null); load();
  };
  return (
    <div>
      <div className="mb-4 flex justify-between"><h2 className="text-xl font-semibold">Portfolio & project apps</h2><Btn onClick={() => setEdit({ name:'', highlightsJson:'[]', active:true })}>Add project</Btn></div>
      <p className="mb-3 text-sm text-slate-400">Portfolio entries power the Portfolio app and project home-screen tiles (link via Home Apps → portfolio slug).</p>
      <Table columns={[{key:'name',label:'Name'},{key:'slug',label:'Slug'},{key:'tag',label:'Tag'}]} rows={rows} onEdit={r=>setEdit({...r,highlightsJson:JSON.stringify(r.highlights||[],null,2)})} onDelete={async r=>{if(confirm('Delete?')){await api('/admin/portfolio/'+r.id,{method:'DELETE'});load();}}} />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{edit.id?'Edit':'New'} project</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Name"><input className={inputCls()} value={edit.name||''} onChange={e=>setEdit({...edit,name:e.target.value})} /></Field>
              <Field label="Slug"><input className={inputCls()} value={edit.slug||''} onChange={e=>setEdit({...edit,slug:e.target.value})} /></Field>
              <Field label="Tag"><input className={inputCls()} value={edit.tag||''} onChange={e=>setEdit({...edit,tag:e.target.value})} /></Field>
              <Field label="Color"><input className={inputCls()} value={edit.color||''} onChange={e=>setEdit({...edit,color:e.target.value})} /></Field>
              <Field label="Role / Year / Stack"><div className="grid grid-cols-3 gap-2"><input className={inputCls()} placeholder="Role" value={edit.role||''} onChange={e=>setEdit({...edit,role:e.target.value})} /><input className={inputCls()} placeholder="Year" value={edit.year||''} onChange={e=>setEdit({...edit,year:e.target.value})} /><input className={inputCls()} placeholder="Stack" value={edit.stack||''} onChange={e=>setEdit({...edit,stack:e.target.value})} /></div></Field>
              <Field label="Summary"><textarea className={inputCls()} rows={3} value={edit.summary||''} onChange={e=>setEdit({...edit,summary:e.target.value})} /></Field>
              <Field label="Highlights JSON"><textarea className={inputCls('font-mono text-xs')} rows={4} value={edit.highlightsJson||'[]'} onChange={e=>setEdit({...edit,highlightsJson:e.target.value})} /></Field>
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeAppsSection() {
  const [rows, setRows] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/home-apps').then(r => setRows(r.apps));
  useEffect(() => {
    load();
    api('/admin/users').then(r => setAllUsers(r.users || [])).catch(() => {});
  }, []);
  const openEdit = async (row) => {
    const base = row || {
      app_id: '', label: '', glyph: '📱', tile: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      screen: 'home', active: true, requires_auth: false, assign_users: false, user_ids: [],
    };
    if (row?.id) {
      const a = await api('/admin/home-apps/' + row.id + '/assignments');
      setEdit({ ...base, user_ids: a.user_ids || [] });
    } else {
      setEdit(base);
    }
  };
  const toggleUser = (uid) => {
    const ids = new Set(edit.user_ids || []);
    if (ids.has(uid)) ids.delete(uid); else ids.add(uid);
    setEdit({ ...edit, user_ids: [...ids] });
  };
  const save = async () => {
    const body = {
      ...edit,
      requires_auth: !!edit.requires_auth || !!edit.assign_users,
      user_ids: edit.assign_users ? (edit.user_ids || []) : [],
    };
    if (edit.id) await api('/admin/home-apps/' + edit.id, { method: 'PUT', body });
    else await api('/admin/home-apps', { method: 'POST', body });
    setEdit(null); load();
  };
  const accessLabel = (r) => {
    if (r.assign_users) return `assigned (${r.assignee_count || 0})`;
    if (r.requires_auth) return 'signed-in';
    return 'public';
  };
  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Home & dock apps</h2>
        <Btn onClick={() => openEdit(null)}>Add app</Btn>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Public apps show for everyone. &quot;Signed-in&quot; apps appear for any logged-in user.
        &quot;Assigned&quot; apps only appear for selected users (inventory, chatbot, etc.).
      </p>
      <Table
        columns={[
          { key: 'app_id', label: 'ID' },
          { key: 'label', label: 'Label' },
          { key: 'screen', label: 'Screen' },
          { key: 'access', label: 'Access', render: accessLabel },
          { key: 'active', label: 'Active', render: r => r.active ? 'yes' : 'no' },
          { key: 'portfolio_slug', label: 'Portfolio slug' },
        ]}
        rows={rows}
        onEdit={openEdit}
        onDelete={async r => { if (confirm('Delete?')) { await api('/admin/home-apps/' + r.id, { method: 'DELETE' }); load(); } }}
      />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{edit.id ? 'Edit' : 'New'} app icon</h3>
            <div className="mt-4 grid gap-3">
              <Field label="App ID"><input className={inputCls()} value={edit.app_id || ''} onChange={e => setEdit({ ...edit, app_id: e.target.value })} placeholder="inventory, chatbot, …" /></Field>
              <Field label="Label"><input className={inputCls()} value={edit.label || ''} onChange={e => setEdit({ ...edit, label: e.target.value })} /></Field>
              <Field label="Glyph"><input className={inputCls()} value={edit.glyph || ''} onChange={e => setEdit({ ...edit, glyph: e.target.value })} /></Field>
              <Field label="Tile gradient"><input className={inputCls()} value={edit.tile || ''} onChange={e => setEdit({ ...edit, tile: e.target.value })} /></Field>
              <Field label="Screen"><select className={inputCls()} value={edit.screen || 'home'} onChange={e => setEdit({ ...edit, screen: e.target.value })}><option value="home">home</option><option value="dock">dock</option></select></Field>
              <Field label="Portfolio slug (project tiles)"><input className={inputCls()} value={edit.portfolio_slug || ''} onChange={e => setEdit({ ...edit, portfolio_slug: e.target.value || null })} placeholder="optional" /></Field>
              <Field label="Sort order"><input type="number" className={inputCls()} value={edit.sort_order || 0} onChange={e => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({ ...edit, active: e.target.checked })} />
                Active (visible when access rules match)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.requires_auth} disabled={!!edit.assign_users} onChange={e => setEdit({ ...edit, requires_auth: e.target.checked })} />
                Require sign-in (any logged-in user)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.assign_users} onChange={e => setEdit({
                  ...edit,
                  assign_users: e.target.checked,
                  requires_auth: e.target.checked ? true : edit.requires_auth,
                })} />
                Assign to specific users only
              </label>
              {edit.assign_users && (
                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3">
                  <p className="text-xs font-medium text-slate-400">Assigned users</p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {allUsers.length === 0 && <p className="text-sm text-slate-500">No users yet — register accounts on the main site first.</p>}
                    {allUsers.map(u => (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                        <input type="checkbox" checked={(edit.user_ids || []).includes(u.id)} onChange={() => toggleUser(u.id)} />
                        <span>{u.email}</span>
                        {u.name && <span className="text-slate-500">({u.name})</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarSection() {
  const [settings, setSettings] = useState(null);
  const [types, setTypes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const load = () => Promise.all([
    api('/admin/calendar/settings').then(r => setSettings(r.settings)),
    api('/admin/calendar/types').then(r => setTypes(r.types)),
    api('/admin/calendar/bookings').then(r => setBookings(r.bookings)),
  ]);
  useEffect(() => { load(); }, []);
  const saveSettings = async () => {
    await api('/admin/calendar/settings', { method: 'PUT', body: settings });
    load();
  };
  if (!settings) return <p className="text-slate-400">Loading…</p>;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Calendar availability</h2>
        <div className="mt-4 grid max-w-xl gap-3 rounded-xl border border-slate-700 p-4">
          <Field label="Timezone"><input className={inputCls()} value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weekday start"><input type="time" className={inputCls()} value={settings.weekday_start?.slice(0,5)} onChange={e=>setSettings({...settings,weekday_start:e.target.value})} /></Field>
            <Field label="Weekday end"><input type="time" className={inputCls()} value={settings.weekday_end?.slice(0,5)} onChange={e=>setSettings({...settings,weekday_end:e.target.value})} /></Field>
          </div>
          <Field label="Slot interval (minutes)"><input type="number" className={inputCls()} value={settings.slot_interval_minutes} onChange={e=>setSettings({...settings,slot_interval_minutes:Number(e.target.value)})} /></Field>
          <Field label="Work weekdays (1=Mon … 7=Sun, comma-separated)"><input className={inputCls()} value={(settings.work_weekdays||[]).join(',')} onChange={e=>setSettings({...settings,work_weekdays:e.target.value.split(',').map(Number).filter(Boolean)})} /></Field>
          <Field label="Blocked dates (YYYY-MM-DD, comma-separated)"><input className={inputCls()} value={(settings.blocked_dates||[]).join(',')} onChange={e=>setSettings({...settings,blocked_dates:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} /></Field>
          <Btn onClick={saveSettings}>Save availability</Btn>
        </div>
      </div>
      <div>
        <h3 className="font-semibold">Meeting types</h3>
        <Table columns={[{key:'label',label:'Label'},{key:'slug',label:'Slug'},{key:'duration_minutes',label:'Minutes'}]} rows={types} onEdit={()=>{}} onDelete={async r=>{if(confirm('Delete type?')){await api('/admin/calendar/types/'+r.slug,{method:'DELETE'});load();}}} />
      </div>
      <div>
        <h3 className="font-semibold">Bookings</h3>
        <Table columns={[{key:'user_email',label:'User'},{key:'type_label',label:'Type'},{key:'starts_at',label:'When',render:r=>new Date(r.starts_at).toLocaleString()},{key:'status',label:'Status'}]} rows={bookings} onEdit={()=>{}} onDelete={async r=>{await api('/admin/calendar/bookings/'+r.id,{method:'DELETE'});load();}} />
      </div>
    </div>
  );
}

function TicketsSection() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const load = () => api('/admin/tickets').then(r => setRows(r.tickets));
  useEffect(() => { load(); }, []);
  const open = async (t) => {
    const r = await api('/admin/tickets/' + t.id);
    setDetail(r);
    setReply('');
  };
  const sendReply = async () => {
    await api('/admin/tickets/' + detail.ticket.id + '/messages', { method: 'POST', body: { body: reply } });
    open(detail.ticket);
    setReply('');
  };
  return (
    <div>
      <h2 className="text-xl font-semibold text-white">Support tickets</h2>
      <p className="mt-1 text-sm text-slate-400">Submitted from the Support app on the main site.</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Table
          columns={[
            { key: 'subject', label: 'Subject' },
            { key: 'contact_name', label: 'Name', render: r => r.contact_name || r.user_name || '—' },
            { key: 'category', label: 'Category' },
            { key: 'status', label: 'Status' },
            { key: 'priority', label: 'Priority' },
          ]}
          rows={rows}
          onEdit={open}
          onDelete={async () => {}}
        />
        {detail && (
          <div className="rounded-xl border border-slate-500 bg-slate-800/80 p-4 text-slate-100">
            <h3 className="font-semibold text-white">#{detail.ticket.id} — {detail.ticket.subject}</h3>
            <dl className="mt-2 grid gap-1 text-sm text-slate-300">
              <div><span className="text-slate-500">Name:</span> {detail.ticket.contact_name || detail.ticket.user_name || '—'}</div>
              <div><span className="text-slate-500">Email:</span> {detail.ticket.email}</div>
              {detail.ticket.contact_phone && <div><span className="text-slate-500">Phone:</span> {detail.ticket.contact_phone}</div>}
              <div><span className="text-slate-500">Category:</span> {detail.ticket.category} · <span className="text-slate-500">Priority:</span> {detail.ticket.priority}</div>
            </dl>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {detail.messages.map(m => (
                <div key={m.id} className={'rounded-lg px-3 py-2 text-sm ' + (m.sender === 'staff' ? 'bg-indigo-900/50' : 'bg-slate-900')}>
                  <span className="text-xs text-slate-400">{m.sender} · {new Date(m.created_at).toLocaleString()}</span>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            <textarea className={inputCls() + ' mt-3'} rows={3} placeholder="Staff reply…" value={reply} onChange={e => setReply(e.target.value)} />
            <Btn className="mt-2" onClick={sendReply}>Send reply</Btn>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select className={inputCls()} value={detail.ticket.status} onChange={async e => { await api('/admin/tickets/' + detail.ticket.id, { method: 'PATCH', body: { status: e.target.value } }); open(detail.ticket); load(); }}>
                <option value="open">open</option><option value="pending">pending</option><option value="closed">closed</option>
              </select>
              <select className={inputCls()} value={detail.ticket.priority} onChange={async e => { await api('/admin/tickets/' + detail.ticket.id, { method: 'PATCH', body: { priority: e.target.value } }); open(detail.ticket); load(); }}>
                <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ stats }) {
  if (!stats) return null;
  const cards = [
    ['Products', stats.products], ['Blog posts', stats.blog_posts], ['Portfolio', stats.portfolio],
    ['Open tickets', stats.open_tickets], ['Upcoming bookings', stats.upcoming_bookings], ['Subscribers', stats.subscribers],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([label, val]) => (
        <div key={label} className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-bold">{val}</p>
        </div>
      ))}
    </div>
  );
}

const NAV = [
  ['dashboard', 'Dashboard'],
  ['products', 'Products'],
  ['blog', 'Blog'],
  ['blog-agents', 'Blog agents'],
  ['portfolio', 'Portfolio'],
  ['home-apps', 'Home apps'],
  ['calendar', 'Calendar'],
  ['tickets', 'Tickets'],
  ['newsletter', 'Newsletter'],
];

function AdminApp({ user, onLogout }) {
  const [section, setSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [subs, setSubs] = useState([]);
  useEffect(() => {
    api('/admin/stats').then(setStats).catch(console.error);
    if (section === 'newsletter') api('/admin/newsletter').then(r => setSubs(r.subscribers));
  }, [section]);

  const content = {
    dashboard: <Dashboard stats={stats} />,
    products: <ProductsSection />,
    blog: <BlogSection />,
    'blog-agents': <BlogAgentsSection />,
    portfolio: <PortfolioSection />,
    'home-apps': <HomeAppsSection />,
    calendar: <CalendarSection />,
    tickets: <TicketsSection />,
    newsletter: (
      <div>
        <h2 className="text-xl font-semibold">Newsletter subscribers</h2>
        <Table columns={[{key:'email',label:'Email'},{key:'created_at',label:'Joined',render:r=>new Date(r.created_at).toLocaleDateString()}]} rows={subs} onEdit={()=>{}} onDelete={async r=>{if(confirm('Remove?')){await api('/admin/newsletter/'+r.id,{method:'DELETE'});api('/admin/newsletter').then(x=>setSubs(x.subscribers));}}} />
      </div>
    ),
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-600 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CreativeBuilds</p>
        <p className="mt-1 truncate text-sm text-slate-300">{user.email}</p>
        <nav className="mt-6 space-y-1">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSection(id)}
              className={'block w-full rounded-lg px-3 py-2 text-left text-sm ' + (section === id ? 'bg-indigo-600 font-medium' : 'text-slate-300 hover:bg-slate-800')}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={onLogout} className="mt-8 text-sm text-slate-500 hover:text-white">Sign out</button>
      </aside>
      <main className="flex-1 overflow-auto bg-slate-950 p-8 text-slate-100">{content[section]}</main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const check = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const r = await api('/auth/me');
      if (r.user?.role === 'admin') setUser(r.user);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);
  useEffect(() => { check(); }, [check]);
  if (!user) return <Login onLogin={setUser} />;
  return <AdminApp user={user} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }} />;
}

createRoot(document.getElementById('root')).render(<App />);
