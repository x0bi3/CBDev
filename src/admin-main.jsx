import './admin.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { QuotesSection } from './components/admin/QuotesSection.jsx';
import { ContentEngineSection } from './components/admin/ContentEngine.jsx';

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
        <p className="mt-1 text-sm text-slate-400">admin.creativebuilds.dev</p>
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

function Table({ columns, rows, onEdit, onDelete, onView, extraActions }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
          <tr>{columns.map(c => <th key={c.key} className="whitespace-nowrap px-4 py-3.5">{c.label}</th>)}<th className="whitespace-nowrap px-4 py-3.5">Actions</th></tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id || row.slug || row.app_id || row.path} className="border-t border-slate-700/80 hover:bg-slate-800/40">
              {columns.map(c => (
                <td key={c.key} className={'px-4 py-3 ' + (c.wrap ? '' : 'whitespace-nowrap')}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
              <td className="px-4 py-3 whitespace-nowrap">
                {onView && <Btn variant="ghost" onClick={() => onView(row)}>View</Btn>}
                {extraActions?.(row)}
                {onEdit && <Btn variant="ghost" className={onView || extraActions ? 'ml-2' : ''} onClick={() => onEdit(row)}>Edit</Btn>}
                {onDelete && <Btn variant="danger" className="ml-2" onClick={() => onDelete(row)}>Delete</Btn>}
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
      launch_type: 'embedded', launch_url: '', store_visible: true, auto_install: false,
      store_description: '', store_pricing: '', store_features: [], store_credits: '',
    };
    if (row && !Array.isArray(base.store_features)) {
      try { base.store_features = JSON.parse(base.store_features || '[]'); }
      catch { base.store_features = []; }
    }
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
    if (r.auto_install) return 'auto-install';
    if (r.assign_users) return `store eligible (${r.assignee_count || 0})`;
    if (r.requires_auth) return 'signed-in store';
    return 'public';
  };
  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-xl font-semibold">Home & dock apps</h2>
        <Btn onClick={() => openEdit(null)}>Add app</Btn>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Public apps show for everyone on the home screen. Auto-install apps appear for all signed-in users.
        Store-eligible apps can be assigned to users — they install from the Service Center, not automatically on home.
      </p>
      <Table
        columns={[
          { key: 'app_id', label: 'ID' },
          { key: 'label', label: 'Label' },
          { key: 'screen', label: 'Screen' },
          { key: 'launch_type', label: 'Launch' },
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
              <Field label="Launch type">
                <select className={inputCls()} value={edit.launch_type || 'embedded'} onChange={e => setEdit({ ...edit, launch_type: e.target.value })}>
                  <option value="embedded">embedded (in phone shell)</option>
                  <option value="route">route (full-page, e.g. /chat)</option>
                  <option value="external">external (new tab)</option>
                </select>
              </Field>
              <Field label="Launch URL">
                <input className={inputCls()} value={edit.launch_url || ''} onChange={e => setEdit({ ...edit, launch_url: e.target.value || null })}
                  placeholder="/chat or https://…" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={edit.store_visible !== false} onChange={e => setEdit({ ...edit, store_visible: e.target.checked })} />
                Visible in Service Center catalog
              </label>
              {edit.store_visible !== false && (
                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 space-y-3">
                  <p className="text-xs font-medium text-slate-400">Service Center listing (tap for details)</p>
                  <Field label="Description">
                    <textarea className={inputCls() + ' min-h-[72px]'} value={edit.store_description || ''}
                      onChange={e => setEdit({ ...edit, store_description: e.target.value })} placeholder="What this service does…" />
                  </Field>
                  <Field label="Pricing">
                    <input className={inputCls()} value={edit.store_pricing || ''}
                      onChange={e => setEdit({ ...edit, store_pricing: e.target.value })} placeholder="e.g. $29/mo · Included · Free trial" />
                  </Field>
                  <Field label="Features (one per line)">
                    <textarea className={inputCls() + ' min-h-[72px]'}
                      value={(edit.store_features || []).join('\n')}
                      onChange={e => setEdit({ ...edit, store_features: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                      placeholder="Feature one&#10;Feature two" />
                  </Field>
                  <Field label="Credits">
                    <input className={inputCls()} value={edit.store_credits || ''}
                      onChange={e => setEdit({ ...edit, store_credits: e.target.value })} placeholder="Built by … · Powered by …" />
                  </Field>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.auto_install} disabled={!!edit.assign_users}
                  onChange={e => setEdit({ ...edit, auto_install: e.target.checked })} />
                Auto-install on home for signed-in users
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={edit.active !== false} onChange={e => setEdit({ ...edit, active: e.target.checked })} />
                Active (visible when access rules match)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.requires_auth} disabled={!!edit.assign_users || !!edit.auto_install} onChange={e => setEdit({ ...edit, requires_auth: e.target.checked })} />
                Require sign-in (any logged-in user)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.assign_users} onChange={e => setEdit({
                  ...edit,
                  assign_users: e.target.checked,
                  requires_auth: e.target.checked ? true : edit.requires_auth,
                  auto_install: e.target.checked ? false : edit.auto_install,
                })} />
                Store eligibility — assign specific users
              </label>
              {edit.assign_users && (
                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-3">
                  <p className="text-xs font-medium text-slate-400">Eligible users (can install from Service Center)</p>
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

const CAL_TZ = 'America/Chicago';

function calDayKey(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function calMonthLabel(year, monthIndex) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CAL_TZ,
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, monthIndex, 15, 12)));
}

function calTimeLabel(iso) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CAL_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function calStatusCls(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled' || s === 'rejected') return 'bg-rose-500/20 text-rose-300';
  if (s === 'pending' || s === 'awaiting_host') return 'bg-amber-500/20 text-amber-200';
  if (s === 'accepted') return 'bg-emerald-500/20 text-emerald-200';
  return 'bg-slate-600/40 text-slate-300';
}

function CalendarSection() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selected, setSelected] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const from = new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).toISOString();
      const to = new Date(Date.UTC(cursor.y, cursor.m + 2, 1)).toISOString();
      const [sum, book] = await Promise.all([
        api('/admin/calendar/summary'),
        api(`/admin/calendar/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ]);
      setSummary(sum);
      setBookings(book.bookings || []);
      if (sum.configured === false) setErr(sum.error || 'Cal.diy is not configured on this host');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  }, [cursor.y, cursor.m]);

  useEffect(() => { load(); }, [load]);

  const byDay = bookings.reduce((acc, b) => {
    const key = calDayKey(b.start);
    (acc[key] ||= []).push(b);
    return acc;
  }, {});

  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const dayKeyFor = (d) => {
    const mm = String(cursor.m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${cursor.y}-${mm}-${dd}`;
  };

  const agendaDay = selectedDay || calDayKey(now.toISOString());
  const agenda = (byDay[agendaDay] || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  const upcoming = bookings
    .filter((b) => new Date(b.end) >= now && !['cancelled', 'rejected'].includes(String(b.status).toLowerCase()))
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 12);
  const manage = summary?.manage || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Calendar</h2>
          <p className="mt-1 text-sm text-slate-400">
            Live Cal.diy bookings ({CAL_TZ}). Manage availability and event types in Cal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={load}>Refresh</Btn>
          {manage.bookings && (
            <a href={manage.bookings} target="_blank" rel="noopener noreferrer">
              <Btn>Open Cal.diy</Btn>
            </a>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Upcoming</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.counts?.upcoming ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">This month</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.counts?.thisMonth ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Public event types</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.counts?.eventTypes ?? '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['Bookings', manage.bookings],
          ['Event types', manage.eventTypes],
          ['Availability', manage.availability],
          ['Public profile', manage.publicProfile],
          ['Intro call', manage.introCall],
          ['Blitz call', manage.blitzCall],
        ].filter(([, href]) => href).map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
            {label} ↗
          </a>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-slate-700 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Btn variant="ghost" onClick={() => setCursor((c) => {
              const m = c.m - 1;
              return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
            })}>←</Btn>
            <h3 className="text-lg font-semibold">{calMonthLabel(cursor.y, cursor.m)}</h3>
            <Btn variant="ghost" onClick={() => setCursor((c) => {
              const m = c.m + 1;
              return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
            })}>→</Btn>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase text-slate-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((d, idx) => {
              if (!d) return <div key={`e-${idx}`} className="min-h-[4.5rem] rounded-lg bg-slate-950/40" />;
              const key = dayKeyFor(d);
              const dayBookings = byDay[key] || [];
              const isSelected = agendaDay === key;
              const isToday = key === calDayKey(now.toISOString());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setSelectedDay(key); setSelected(dayBookings[0] || null); }}
                  className={
                    'min-h-[4.5rem] rounded-lg border p-1.5 text-left transition ' +
                    (isSelected
                      ? 'border-indigo-500 bg-indigo-950/40'
                      : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-500') +
                    (isToday ? ' ring-1 ring-indigo-400/50' : '')
                  }
                >
                  <div className="text-xs font-medium text-slate-300">{d}</div>
                  <div className="mt-1 space-y-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <div key={b.uid} className="truncate rounded bg-indigo-600/30 px-1 py-0.5 text-[10px] text-indigo-100">
                        {calTimeLabel(b.start)} {b.eventTypeTitle || b.title}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-[10px] text-slate-500">+{dayBookings.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {loading && <p className="mt-3 text-sm text-slate-500">Loading Cal.diy…</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="font-semibold">Day agenda — {agendaDay}</h3>
            {agenda.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No bookings this day.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {agenda.map((b) => (
                  <li key={b.uid}>
                    <button
                      type="button"
                      onClick={() => setSelected(b)}
                      className={
                        'w-full rounded-lg border px-3 py-2 text-left text-sm transition ' +
                        (selected?.uid === b.uid
                          ? 'border-indigo-500 bg-indigo-950/30'
                          : 'border-slate-700 hover:bg-slate-800/60')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{calTimeLabel(b.start)} – {calTimeLabel(b.end)}</span>
                        <span className={'rounded px-1.5 py-0.5 text-[10px] uppercase ' + calStatusCls(b.status)}>
                          {b.status}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-slate-300">{b.eventTypeTitle || b.title}</div>
                      <div className="truncate text-xs text-slate-500">
                        {(b.attendees || []).map((a) => a.email || a.name).filter(Boolean).join(', ') || 'No attendee'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="font-semibold">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing upcoming in this window.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {upcoming.map((b) => (
                  <li key={b.uid} className="flex items-start justify-between gap-2 border-t border-slate-800 pt-2 first:border-0 first:pt-0">
                    <button type="button" className="text-left hover:text-indigo-300" onClick={() => {
                      setSelectedDay(calDayKey(b.start));
                      setSelected(b);
                    }}>
                      <div className="font-medium">{b.eventTypeTitle || b.title}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(b.start).toLocaleString('en-US', { timeZone: CAL_TZ })}
                      </div>
                    </button>
                    <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ' + calStatusCls(b.status)}>
                      {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <div className="rounded-xl border border-indigo-700/50 bg-indigo-950/20 p-4">
              <h3 className="font-semibold">Booking detail</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="text-slate-500">Title</dt><dd>{selected.title}</dd></div>
                <div><dt className="text-slate-500">When</dt>
                  <dd>{new Date(selected.start).toLocaleString('en-US', { timeZone: CAL_TZ })} → {calTimeLabel(selected.end)} CT</dd>
                </div>
                <div><dt className="text-slate-500">Attendees</dt>
                  <dd>{(selected.attendees || []).map((a) => `${a.name || 'Guest'} <${a.email}>`).join(', ') || '—'}</dd>
                </div>
                {selected.location && <div><dt className="text-slate-500">Location</dt><dd className="break-all">{selected.location}</dd></div>}
                {selected.description && <div><dt className="text-slate-500">Notes</dt><dd className="whitespace-pre-wrap text-slate-300">{selected.description}</dd></div>}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={selected.links.booking} target="_blank" rel="noopener noreferrer"><Btn>Open in Cal</Btn></a>
                <a href={selected.links.reschedule} target="_blank" rel="noopener noreferrer"><Btn variant="ghost">Reschedule</Btn></a>
                <a href={selected.links.cancel} target="_blank" rel="noopener noreferrer"><Btn variant="danger">Cancel</Btn></a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Event types</h3>
          {manage.eventTypes && (
            <a href={manage.eventTypes} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-300 hover:underline">
              Manage in Cal.diy ↗
            </a>
          )}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Slug</th>
                <th className="px-2 py-2">Minutes</th>
                <th className="px-2 py-2">Visibility</th>
                <th className="px-2 py-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.eventTypes || []).map((et) => (
                <tr key={et.id} className="border-t border-slate-800">
                  <td className="px-2 py-2">{et.title}</td>
                  <td className="px-2 py-2 font-mono text-xs text-slate-400">{et.slug}</td>
                  <td className="px-2 py-2">{et.lengthMinutes}</td>
                  <td className="px-2 py-2">{et.hidden ? 'Hidden' : 'Public'}</td>
                  <td className="px-2 py-2">
                    <a href={et.publicUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">
                      Open ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!summary?.eventTypes?.length && !loading && (
            <p className="mt-2 text-sm text-slate-500">No event types found in Cal.diy.</p>
          )}
        </div>
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
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Support tickets</h2>
        <p className="mt-1 text-sm text-slate-400">Submitted from the Support app on the main site.</p>
      </div>
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
  );
}

function LiveChatSection({ initialThreadId, onThreadOpened }) {
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    const q = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}`;
    return api('/admin/chat/threads' + q).then((r) => setRows(r.threads || []));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const open = async (t) => {
    const r = await api('/admin/chat/threads/' + (t.id || t));
    setDetail(r);
    setReply('');
    onThreadOpened?.();
  };

  useEffect(() => {
    if (initialThreadId) open(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    if (!detail?.thread?.id) return;
    const id = setInterval(() => {
      api('/admin/chat/threads/' + detail.thread.id)
        .then((r) => setDetail(r))
        .catch(() => {});
    }, 2500);
    return () => clearInterval(id);
  }, [detail?.thread?.id]);

  const accept = async () => {
    setBusy(true);
    try {
      const r = await api('/admin/chat/threads/' + detail.thread.id + '/accept', { method: 'POST' });
      setDetail(r);
      load();
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      const r = await api('/admin/chat/threads/' + detail.thread.id + '/release', { method: 'POST' });
      setDetail(r);
      load();
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const r = await api('/admin/chat/threads/' + detail.thread.id + '/close', { method: 'POST' });
      setDetail(r);
      load();
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const r = await api('/admin/chat/threads/' + detail.thread.id + '/messages', {
        method: 'POST',
        body: { body: reply },
      });
      setDetail(r);
      setReply('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const statusBadge = (s) => {
    const colors = {
      awaiting_ryan: 'text-amber-300',
      live: 'text-emerald-300',
      bot: 'text-slate-400',
      closed: 'text-slate-500',
    };
    return <span className={colors[s] || 'text-slate-400'}>{s}</span>;
  };

  const msgClass = (role) => {
    if (role === 'ryan') return 'bg-emerald-900/50';
    if (role === 'miranda') return 'bg-indigo-900/40';
    if (role === 'system') return 'bg-slate-800 italic text-slate-400';
    return 'bg-slate-900';
  };

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Live Chat</h2>
        <p className="mt-1 text-sm text-slate-400">
          Miranda handoffs from the marketing site — accept to take over the conversation.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {['all', 'awaiting_ryan', 'live', 'bot', 'closed'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={
              'rounded-lg px-3 py-1.5 text-sm min-h-10 ' +
              (filter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')
            }
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <Table
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status', render: (r) => statusBadge(r.status) },
          { key: 'visitor_name', label: 'Name', render: (r) => r.visitorName || '—' },
          { key: 'last_preview', label: 'Last message', render: (r) => (r.lastPreview || '').slice(0, 80) },
          {
            key: 'last_message_at',
            label: 'Updated',
            render: (r) => (r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleString() : '—'),
          },
        ]}
        rows={rows}
        onEdit={open}
        onDelete={async () => {}}
      />
      {detail && (
        <div className="rounded-xl border border-slate-500 bg-slate-800/80 p-4 text-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">{detail.thread.title || 'Conversation'}</h3>
              <p className="mt-1 text-sm text-slate-400">
                Status: {statusBadge(detail.thread.status)}
                {detail.thread.visitorEmail ? ` · ${detail.thread.visitorEmail}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {detail.thread.status === 'awaiting_ryan' ? (
                <Btn onClick={accept} disabled={busy}>
                  Accept live chat
                </Btn>
              ) : null}
              {detail.thread.status === 'live' ? (
                <>
                  <Btn onClick={release} disabled={busy}>
                    Return to Miranda
                  </Btn>
                  <Btn onClick={close} disabled={busy}>
                    Close
                  </Btn>
                </>
              ) : null}
              {detail.thread.status !== 'closed' && detail.thread.status !== 'live' && detail.thread.status !== 'awaiting_ryan' ? (
                <Btn onClick={close} disabled={busy}>
                  Close
                </Btn>
              ) : null}
            </div>
          </div>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {(detail.messages || []).map((m) => (
              <div key={m.id} className={'rounded-lg px-3 py-2 text-sm ' + msgClass(m.role)}>
                <span className="text-xs text-slate-400">
                  {m.role} · {new Date(m.createdAt).toLocaleString()}
                </span>
                <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
          {detail.thread.status === 'live' ? (
            <>
              <textarea
                className={inputCls() + ' mt-3'}
                rows={3}
                placeholder="Reply as Ryan…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <Btn className="mt-2" onClick={sendReply} disabled={busy || !reply.trim()}>
                Send reply
              </Btn>
            </>
          ) : detail.thread.status === 'awaiting_ryan' ? (
            <p className="mt-3 text-sm text-amber-200">Visitor is waiting — accept to join.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function InquiriesSection() {
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const load = () => api('/admin/inquiries').then(r => setRows(r.inquiries || []));
  useEffect(() => { load(); }, []);
  const open = async (row) => {
    const r = await api('/admin/inquiries/' + row.id);
    setDetail(r.inquiry);
  };
  const setStatus = async (status) => {
    await api('/admin/inquiries/' + detail.id, { method: 'PATCH', body: { status } });
    load();
    open({ id: detail.id });
  };
  const categories = (r) => {
    try {
      const c = typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories;
      return Array.isArray(c) ? c.join(', ') : String(c || '');
    } catch { return ''; }
  };
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Project inquiries</h2>
        <p className="mt-1 text-sm text-slate-400">Inquiry + Project Vibe Check from www — Cal follow-up runs automatically</p>
      </div>
      <Table
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'source', label: 'Source', render: r => r.source || 'inquiry' },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'When', render: r => new Date(r.created_at).toLocaleString() },
        ]}
        rows={rows}
        onEdit={open}
        onDelete={async () => {}}
      />
      {detail && (
        <div className="rounded-xl border border-slate-500 bg-slate-800/80 p-4 text-slate-100">
          <h3 className="font-semibold text-white">#{detail.id} {detail.name}</h3>
          <dl className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
            <div><span className="text-slate-500">Email:</span> {detail.email}</div>
            {detail.company && <div><span className="text-slate-500">Company:</span> {detail.company}</div>}
            <div><span className="text-slate-500">Source:</span> {detail.source || 'inquiry'}</div>
            <div><span className="text-slate-500">Categories:</span> {categories(detail)}</div>
            {detail.budget && <div><span className="text-slate-500">Budget:</span> {detail.budget}</div>}
            {detail.timeline && <div><span className="text-slate-500">Timeline:</span> {detail.timeline}</div>}
            {detail.cal_booking_uid && <div><span className="text-slate-500">Cal follow-up:</span> {detail.cal_booking_uid}</div>}
          </dl>
          <p className="mt-4 whitespace-pre-wrap text-sm">{detail.overview}</p>
          {detail.answers && Object.keys(typeof detail.answers === 'string' ? JSON.parse(detail.answers) : detail.answers).length > 0 && (
            <div className="mt-4 rounded-lg bg-slate-900 p-3 text-sm">
              <p className="text-xs uppercase text-slate-500">Details</p>
              {Object.entries(typeof detail.answers === 'string' ? JSON.parse(detail.answers) : detail.answers).map(([k, v]) => (
                <p key={k} className="mt-2"><span className="text-slate-500">{k}:</span> {v}</p>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <select className={inputCls()} value={detail.status} onChange={e => setStatus(e.target.value)}>
              {['new', 'reviewing', 'replied', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <a className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white" href={'mailto:' + detail.email + '?subject=Re: Your CreativeBuilds inquiry'}>Reply by email</a>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ stats }) {
  if (!stats) return null;
  const cards = [
    ['Products', stats.products], ['Portfolio', stats.portfolio],
    ['SEO pages', stats.seo_pages || 0],
    ['Open tickets', stats.open_tickets], ['New inquiries', stats.new_inquiries || 0], ['Upcoming bookings', stats.upcoming_bookings], ['Subscribers', stats.subscribers],
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

function NewsletterSection() {
  const [subs, setSubs] = useState([]);
  const [sends, setSends] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);

  const reload = () => {
    api('/admin/newsletter').then(r => setSubs(r.subscribers)).catch(console.error);
    api('/admin/newsletter/sends').then(r => setSends(r.sends)).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const send = async (testOnly) => {
    if (testOnly && !testEmail.trim()) {
      setStatus('Enter a test email first');
      return;
    }
    setSending(true);
    setStatus('');
    try {
      const r = await api('/admin/newsletter/send', {
        method: 'POST',
        body: testOnly ? { subject, body, testEmail: testEmail.trim() } : { subject, body },
      });
      setStatus(testOnly
        ? `Test sent to ${testEmail} (${r.sent}/${r.total} ok)`
        : `Broadcast sent — ${r.sent} delivered, ${r.failed} failed`);
      if (!testOnly) reload();
    } catch (ex) {
      setStatus(ex.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Send newsletter</h2>
        <p className="mt-1 text-sm text-slate-400">{subs.filter(s => !s.unsubscribed_at).length} active subscribers</p>
        <div className="mt-4 max-w-2xl space-y-3">
          <input className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea className="min-h-[160px] w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm" placeholder="Plain-text body" value={body} onChange={e => setBody(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <input className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm" placeholder="Test email (optional)" value={testEmail} onChange={e => setTestEmail(e.target.value)} type="email" />
            <Btn onClick={() => send(true)} className="disabled:opacity-50" disabled={sending || !subject || !body}>Send test</Btn>
            <Btn variant="danger" onClick={() => { if (confirm(`Send to ${subs.filter(s => !s.unsubscribed_at).length} subscribers?`)) send(false); }} className="disabled:opacity-50" disabled={sending || !subject || !body}>Send to all</Btn>
          </div>
          {status && <p className="text-sm text-slate-300">{status}</p>}
        </div>
      </div>
      {sends.length > 0 && (
        <div>
          <h3 className="text-lg font-medium">Recent sends</h3>
          <Table columns={[
            { key: 'subject', label: 'Subject' },
            { key: 'recipient_count', label: 'Sent' },
            { key: 'failed_count', label: 'Failed' },
            { key: 'sent_at', label: 'When', render: r => new Date(r.sent_at).toLocaleString() },
          ]} rows={sends} onEdit={() => {}} onDelete={() => {}} />
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold">Subscribers</h2>
        <Table columns={[
          { key: 'email', label: 'Email' },
          { key: 'created_at', label: 'Joined', render: r => new Date(r.created_at).toLocaleDateString() },
          { key: 'unsubscribed_at', label: 'Status', render: r => r.unsubscribed_at ? 'Unsubscribed' : 'Active' },
        ]} rows={subs} onEdit={() => {}} onDelete={async r => {
          if (confirm('Remove subscriber?')) {
            await api('/admin/newsletter/' + r.id, { method: 'DELETE' });
            reload();
          }
        }} />
      </div>
    </div>
  );
}

function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api('/admin/orders').then(r => setOrders(r.orders)).catch(console.error);
  }, []);

  const money = (cents) => '£' + (cents / 100).toFixed(2);

  return (
    <div>
      <h2 className="text-xl font-semibold">Merch orders</h2>
      <p className="mt-1 text-sm text-slate-400">{orders.length} recent orders</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/80 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <React.Fragment key={o.id}>
                <tr className="border-t border-slate-700/80 hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-2.5">
                    <div>{o.customer_name}</div>
                    <div className="text-xs text-slate-400">{o.email}</div>
                  </td>
                  <td className="px-4 py-2.5">{money(o.subtotal_cents)}</td>
                  <td className="px-4 py-2.5">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <Btn variant="ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      {expanded === o.id ? 'Hide' : 'Items'}
                    </Btn>
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr className="border-t border-slate-700/50 bg-slate-900/60">
                    <td colSpan={5} className="px-4 py-3 text-sm text-slate-300">
                      <p>{o.address_line}, {o.city} {o.postcode}</p>
                      <ul className="mt-2 list-disc pl-5">
                        {(o.items || []).map((it, i) => (
                          <li key={i}>{it.quantity}× {it.product_name}{it.variant_label ? ` (${it.variant_label})` : ''} — {money(it.line_total_cents)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StripeSection() {
  const [data, setData] = useState(null);
  const [subs, setSubs] = useState([]);
  const load = () => Promise.all([
    api('/admin/stripe/settings').then(setData),
    api('/admin/stripe/subscriptions').then(r => setSubs(r.subscriptions)).catch(() => {}),
  ]);
  useEffect(() => { load(); }, []);
  const save = async () => {
    await api('/admin/stripe/settings', { method: 'PUT', body: data.settings });
    load();
  };
  if (!data) return <p className="text-slate-400">Loading...</p>;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Stripe Configuration</h2>
        <div className="mt-2 flex gap-3">
          <span className={'rounded-full px-3 py-1 text-xs font-medium ' + (data.configured ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300')}>
            {data.configured ? 'Secret key configured' : 'No secret key'}
          </span>
          <span className={'rounded-full px-3 py-1 text-xs font-medium ' + (data.webhookConfigured ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300')}>
            {data.webhookConfigured ? 'Webhook configured' : 'No webhook secret'}
          </span>
        </div>
      </div>
      <div className="max-w-xl rounded-xl border border-slate-700 p-4 space-y-3">
        <Field label="Publishable key">
          <input className={inputCls()} value={data.settings?.publishable_key || ''} onChange={e => setData({...data, settings: {...data.settings, publishable_key: e.target.value}})} placeholder="pk_live_..." />
        </Field>
        <Field label="Blitz Call price (cents)">
          <input type="number" className={inputCls()} value={data.settings?.blitz_price_cents || 2000} onChange={e => setData({...data, settings: {...data.settings, blitz_price_cents: Number(e.target.value)}})} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={data.settings?.connect_enabled || false} onChange={e => setData({...data, settings: {...data.settings, connect_enabled: e.target.checked}})} />
          Connect enabled (for client platform payments)
        </label>
        <Btn onClick={save}>Save Stripe settings</Btn>
      </div>
      {subs.length > 0 && (
        <div>
          <h3 className="font-semibold">Active hosting subscriptions</h3>
          <Table columns={[
            {key:'user_email',label:'User'},
            {key:'tier',label:'Tier',render:r=><span className="capitalize">{r.tier}</span>},
            {key:'billing_cycle',label:'Cycle'},
            {key:'status',label:'Status',render:r=><span className={r.status==='active'?'text-emerald-400':'text-slate-400'}>{r.status}</span>},
            {key:'created_at',label:'Since',render:r=>new Date(r.created_at).toLocaleDateString()},
          ]} rows={subs} onEdit={()=>{}} onDelete={()=>{}} />
        </div>
      )}
      <div className="rounded-xl border border-slate-600 bg-slate-900/50 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-200">Setup checklist</p>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li>Set STRIPE_SECRET_KEY in server .env</li>
          <li>Set STRIPE_PUBLISHABLE_KEY in server .env</li>
          <li>Set STRIPE_WEBHOOK_SECRET in server .env</li>
          <li>Create webhook endpoint in Stripe Dashboard pointing to https://app.creativebuilds.dev/api/stripe/webhook</li>
          <li>Subscribe to events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted</li>
        </ul>
      </div>
    </div>
  );
}

const NAV = [
  ['dashboard', 'Dashboard'],
  ['products', 'Products'],
  ['content-engine', 'Content Engine'],
  ['portfolio', 'Portfolio'],
  ['home-apps', 'Home apps'],
  ['calendar', 'Calendar'],
  ['inquiries', 'Inquiries'],
  ['live-chat', 'Live Chat'],
  ['quotes', 'Quotes'],
  ['tickets', 'Tickets'],
  ['orders', 'Orders'],
  ['newsletter', 'Newsletter'],
  ['stripe', 'Stripe'],
];

function AdminNav({ section, setSection, onNavigate, awaitingCount = 0 }) {
  return (
    <nav className="mt-6 space-y-1">
      {NAV.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            setSection(id);
            onNavigate?.();
          }}
          className={
            'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm min-h-11 ' +
            (section === id ? 'bg-indigo-600 font-medium' : 'text-slate-300 hover:bg-slate-800')
          }
        >
          <span>{label}</span>
          {id === 'live-chat' && awaitingCount > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-slate-900">
              {awaitingCount}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function AdminApp({ user, onLogout }) {
  const [section, setSection] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [liveChatThreadId, setLiveChatThreadId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('section') === 'live-chat') {
      setSection('live-chat');
      const tid = params.get('thread');
      if (tid) setLiveChatThreadId(tid);
    }
  }, []);

  useEffect(() => {
    api('/admin/stats').then(setStats).catch(console.error);
  }, [section]);

  useEffect(() => {
    const tick = () =>
      api('/admin/chat/awaiting-count')
        .then((r) => setAwaitingCount(r.count || 0))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const content = {
    dashboard: <Dashboard stats={stats} />,
    products: <ProductsSection />,
    'content-engine': <ContentEngineSection api={api} Btn={Btn} Table={Table} Field={Field} inputCls={inputCls} />,
    portfolio: <PortfolioSection />,
    'home-apps': <HomeAppsSection />,
    calendar: <CalendarSection />,
    inquiries: <InquiriesSection />,
    'live-chat': (
      <LiveChatSection
        initialThreadId={liveChatThreadId}
        onThreadOpened={() => setLiveChatThreadId(null)}
      />
    ),
    quotes: <QuotesSection api={api} Btn={Btn} Table={Table} Field={Field} inputCls={inputCls} />,
    tickets: <TicketsSection />,
    orders: <OrdersSection />,
    newsletter: <NewsletterSection />,
    stripe: <StripeSection />,
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header className="sticky top-0 z-[60] flex h-14 items-center gap-3 border-b border-slate-600 bg-slate-900 px-4 lg:hidden">
        <button
          type="button"
          className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-600"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={'block h-0.5 w-4 bg-current transition ' + (menuOpen ? 'translate-y-2 rotate-45' : '')} />
          <span className={'block h-0.5 w-4 bg-current transition ' + (menuOpen ? 'opacity-0' : '')} />
          <span className={'block h-0.5 w-4 bg-current transition ' + (menuOpen ? '-translate-y-2 -rotate-45' : '')} />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CreativeBuilds</p>
          <p className="truncate text-sm text-slate-300">{user.email}</p>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 top-14 z-50 lg:hidden" role="presentation">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={closeMenu} />
          <aside
            id="admin-mobile-nav"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-slate-600 bg-slate-900 p-4 shadow-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CreativeBuilds</p>
            <p className="mt-1 truncate text-sm text-slate-300">{user.email}</p>
            <AdminNav section={section} setSection={setSection} onNavigate={closeMenu} awaitingCount={awaitingCount} />
            <button type="button" onClick={onLogout} className="mt-8 min-h-11 text-left text-sm text-slate-500 hover:text-white">
              Sign out
            </button>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 border-r border-slate-600 bg-slate-900 p-4 lg:block">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">CreativeBuilds</p>
        <p className="mt-1 truncate text-sm text-slate-300">{user.email}</p>
        <AdminNav section={section} setSection={setSection} awaitingCount={awaitingCount} />
        <button type="button" onClick={onLogout} className="mt-8 text-sm text-slate-500 hover:text-white">
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">{content[section]}</main>
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
