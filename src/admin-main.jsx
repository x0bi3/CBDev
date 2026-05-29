import './admin.css';
import React, { useState, useEffect, useCallback } from 'react';
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
  return <label className="block"><span className="text-xs font-medium text-slate-400">{label}</span><div className="mt-1">{children}</div></label>;
}

function inputCls(extra = '') {
  return 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm ' + extra;
}

function ProductsSection() {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/products').then(r => setRows(r.products));
  useEffect(() => { load(); }, []);
  const save = async () => {
    const body = { ...edit, price_cents: Math.round(Number(edit.price_cents || edit.price * 100)), images: JSON.parse(edit.imagesJson || '[]'), variants: JSON.parse(edit.variantsJson || '{}') };
    if (edit.id) await api('/admin/products/' + edit.id, { method: 'PUT', body });
    else await api('/admin/products', { method: 'POST', body });
    setEdit(null); load();
  };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Products</h2><Btn onClick={() => setEdit({ name:'', category_slug:'apparel', price_cents:0, imagesJson:'[]', variantsJson:'{}', active:true })}>Add product</Btn></div>
      <Table columns={[{key:'name',label:'Name'},{key:'category_slug',label:'Category'},{key:'price_cents',label:'Price ¢',render:r=>'£'+(r.price_cents/100).toFixed(0)},{key:'active',label:'Active',render:r=>r.active?'Yes':'No'}]} rows={rows} onEdit={r=>setEdit({...r,imagesJson:JSON.stringify(r.images||[],null,2),variantsJson:JSON.stringify(r.variants||{},null,2)})} onDelete={async r=>{if(confirm('Delete?')){await api('/admin/products/'+r.id,{method:'DELETE'});load();}}} />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{edit.id?'Edit':'New'} product</h3>
            <div className="mt-4 grid gap-3">
              <Field label="Name"><input className={inputCls()} value={edit.name||''} onChange={e=>setEdit({...edit,name:e.target.value})} /></Field>
              <Field label="Slug"><input className={inputCls()} value={edit.slug||''} onChange={e=>setEdit({...edit,slug:e.target.value})} /></Field>
              <Field label="Category slug"><input className={inputCls()} value={edit.category_slug||''} onChange={e=>setEdit({...edit,category_slug:e.target.value})} /></Field>
              <Field label="Price (cents)"><input type="number" className={inputCls()} value={edit.price_cents||0} onChange={e=>setEdit({...edit,price_cents:Number(e.target.value)})} /></Field>
              <Field label="Color gradient"><input className={inputCls()} value={edit.color||''} onChange={e=>setEdit({...edit,color:e.target.value})} /></Field>
              <Field label="Description"><textarea className={inputCls()} rows={3} value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})} /></Field>
              <Field label="Images JSON"><textarea className={inputCls('font-mono text-xs')} rows={3} value={edit.imagesJson||'[]'} onChange={e=>setEdit({...edit,imagesJson:e.target.value})} /></Field>
              <Field label="Variants JSON"><textarea className={inputCls('font-mono text-xs')} rows={3} value={edit.variantsJson||'{}'} onChange={e=>setEdit({...edit,variantsJson:e.target.value})} /></Field>
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancel</Btn></div>
          </div>
        </div>
      )}
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
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/home-apps').then(r => setRows(r.apps));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (edit.id) await api('/admin/home-apps/' + edit.id, { method: 'PUT', body: edit });
    else await api('/admin/home-apps', { method: 'POST', body: edit });
    setEdit(null); load();
  };
  return (
    <div>
      <div className="mb-4 flex justify-between"><h2 className="text-xl font-semibold">Home & dock apps</h2><Btn onClick={() => setEdit({ app_id:'', label:'', glyph:'📱', tile:'linear-gradient(135deg,#6366f1,#8b5cf6)', screen:'home', active:true })}>Add app</Btn></div>
      <Table columns={[{key:'app_id',label:'ID'},{key:'label',label:'Label'},{key:'screen',label:'Screen'},{key:'requires_auth',label:'Auth only',render:r=>r.requires_auth?'yes':'no'},{key:'portfolio_slug',label:'Portfolio slug'}]} rows={rows} onEdit={setEdit} onDelete={async r=>{if(confirm('Delete?')){await api('/admin/home-apps/'+r.id,{method:'DELETE'});load();}}} />
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{edit.id?'Edit':'New'} app icon</h3>
            <div className="mt-4 grid gap-3">
              <Field label="App ID"><input className={inputCls()} value={edit.app_id||''} onChange={e=>setEdit({...edit,app_id:e.target.value})} /></Field>
              <Field label="Label"><input className={inputCls()} value={edit.label||''} onChange={e=>setEdit({...edit,label:e.target.value})} /></Field>
              <Field label="Glyph"><input className={inputCls()} value={edit.glyph||''} onChange={e=>setEdit({...edit,glyph:e.target.value})} /></Field>
              <Field label="Tile gradient"><input className={inputCls()} value={edit.tile||''} onChange={e=>setEdit({...edit,tile:e.target.value})} /></Field>
              <Field label="Screen"><select className={inputCls()} value={edit.screen||'home'} onChange={e=>setEdit({...edit,screen:e.target.value})}><option value="home">home</option><option value="dock">dock</option></select></Field>
              <Field label="Portfolio slug (project tiles)"><input className={inputCls()} value={edit.portfolio_slug||''} onChange={e=>setEdit({...edit,portfolio_slug:e.target.value||null})} placeholder="optional" /></Field>
              <Field label="Sort order"><input type="number" className={inputCls()} value={edit.sort_order||0} onChange={e=>setEdit({...edit,sort_order:Number(e.target.value)})} /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={!!edit.requires_auth} onChange={e=>setEdit({...edit,requires_auth:e.target.checked})} />
                Requires sign-in (e.g. Calendar)
              </label>
            </div>
            <div className="mt-6 flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancel</Btn></div>
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
      <h2 className="text-xl font-semibold">Support tickets</h2>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Table columns={[{key:'subject',label:'Subject'},{key:'email',label:'Email'},{key:'status',label:'Status'},{key:'priority',label:'Priority'}]} rows={rows} onEdit={open} onDelete={async ()=>{}} />
        {detail && (
          <div className="rounded-xl border border-slate-700 p-4">
            <h3 className="font-semibold">{detail.ticket.subject}</h3>
            <p className="text-sm text-slate-400">{detail.ticket.email} · {detail.ticket.status} · {detail.ticket.priority}</p>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {detail.messages.map(m => (
                <div key={m.id} className={'rounded-lg px-3 py-2 text-sm ' + (m.sender === 'staff' ? 'bg-indigo-900/50' : 'bg-slate-800')}>
                  <span className="text-xs text-slate-400">{m.sender}</span>
                  <p className="mt-1">{m.body}</p>
                </div>
              ))}
            </div>
            <textarea className={inputCls() + ' mt-3'} rows={3} placeholder="Staff reply…" value={reply} onChange={e=>setReply(e.target.value)} />
            <Btn className="mt-2" onClick={sendReply}>Send reply</Btn>
            <select className={inputCls() + ' mt-3'} value={detail.ticket.status} onChange={async e=>{await api('/admin/tickets/'+detail.ticket.id,{method:'PATCH',body:{status:e.target.value}});open(detail.ticket);load();}}>
              <option>open</option><option>closed</option><option>pending</option>
            </select>
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
      <aside className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">CreativeBuilds</p>
        <p className="mt-1 truncate text-sm text-slate-400">{user.email}</p>
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
      <main className="flex-1 overflow-auto p-8">{content[section]}</main>
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
