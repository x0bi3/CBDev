import React, { useState, useEffect } from 'react';
import { CATEGORIES, Q, checkIf, computeQuote, hostingLine } from './quotePricing.js';

const usd = (dollars) => '$' + Number(dollars || 0).toLocaleString('en-US');
const centsToUsd = (c) => '$' + (Number(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const blankState = () => ({ cat: null, step: 0, ans: {}, adds: {}, tier: null, pkg: null, notes: {}, hist: [] });

// Wizard mirrors sales_resources/tools/pricing-calculator.html selection logic.
function QuoteWizard({ api, Btn, Field, inputCls, onSaved, onCancel }) {
  const [S, setS] = useState(blankState);
  const [client, setClient] = useState({ client_name: '', client_email: '', company: '' });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const questions = S.cat ? Q[S.cat] : [];
  // Advance past skipped (showIf) questions.
  let step = S.step;
  while (S.cat && step < questions.length && questions[step].showIf && !checkIf(questions[step].showIf, S.ans)) step += 1;
  const done = S.cat && step >= questions.length;
  const q = !done && S.cat ? questions[step] : null;
  const { items, total, tier } = computeQuote(S);
  const deposit = Math.round(total * 0.25);

  const pushHist = (next) => setS((s) => ({ ...next, hist: [...s.hist, { step: s.step, ans: JSON.parse(JSON.stringify(s.ans)), adds: JSON.parse(JSON.stringify(s.adds)), tier: s.tier, pkg: s.pkg, notes: JSON.parse(JSON.stringify(s.notes)) }] }));

  const selCat = (cat) => setS({ ...blankState(), cat });

  const selSingle = (qId, opt) => {
    setS((s) => {
      const ans = { ...s.ans, [qId]: opt.v };
      const adds = { ...s.adds };
      let tierNext = s.tier, pkgNext = s.pkg;
      if (opt.tier) tierNext = opt.tier;
      if (opt.tierBump) tierNext = opt.tierBump;
      if (opt.add) adds[qId] = [opt.add];
      if (opt.adds) adds[qId] = [...opt.adds];
      if (opt.pkg) pkgNext = opt.pkg;
      if (opt.addN) { adds[qId] = Array(opt.addN.n).fill(opt.addN.a); }
      const hist = [...s.hist, { step: s.step, ans: JSON.parse(JSON.stringify(s.ans)), adds: JSON.parse(JSON.stringify(s.adds)), tier: s.tier, pkg: s.pkg, notes: JSON.parse(JSON.stringify(s.notes)) }];
      return { ...s, ans, adds, tier: tierNext, pkg: pkgNext, hist, step: s.step + 1 };
    });
  };

  const togMulti = (qId, opt) => {
    setS((s) => {
      const cur = Array.isArray(s.ans[qId]) ? [...s.ans[qId]] : [];
      const curAdds = Array.isArray(s.adds[qId]) ? [...s.adds[qId]] : [];
      const removeAdd = (a) => { const i = curAdds.indexOf(a); if (i > -1) curAdds.splice(i, 1); };
      const addAdd = (a) => curAdds.push(a);

      if (opt.ex) {
        return { ...s, ans: { ...s.ans, [qId]: [opt.v] }, adds: { ...s.adds, [qId]: [] } };
      }
      // Exclusive group (e.g. logo).
      if (opt.exclusive) {
        (Q[s.cat].find((x) => x.id === qId)?.opts || []).filter((o) => o.exclusive === opt.exclusive && o.v !== opt.v).forEach((o) => {
          const idx = cur.indexOf(o.v);
          if (idx > -1) { cur.splice(idx, 1); if (o.add) removeAdd(o.add); }
        });
      }
      // Drop "none" when picking a real option.
      const ni = cur.indexOf('none');
      if (ni > -1) cur.splice(ni, 1);

      const i = cur.indexOf(opt.v);
      if (i > -1) {
        cur.splice(i, 1);
        if (opt.add) removeAdd(opt.add);
        if (opt.adds) opt.adds.forEach(removeAdd);
      } else {
        cur.push(opt.v);
        if (opt.add && !opt.inc) addAdd(opt.add);
        if (opt.adds) opt.adds.forEach(addAdd);
      }
      return { ...s, ans: { ...s.ans, [qId]: cur }, adds: { ...s.adds, [qId]: curAdds } };
    });
  };

  const setNum = (qId, v, min, max) => setS((s) => ({ ...s, ans: { ...s.ans, [qId]: Math.max(min, Math.min(max, v)) } }));
  const setText = (qId, v) => setS((s) => ({ ...s, ans: { ...s.ans, [qId]: v } }));
  const setNote = (qId, v) => setS((s) => ({ ...s, notes: { ...s.notes, [qId]: v } }));
  const nextQ = () => setS((s) => ({ ...s, step: step + 1 }));

  const goBack = () => setS((s) => {
    if (s.hist.length) { const p = s.hist[s.hist.length - 1]; return { ...s, ...p, hist: s.hist.slice(0, -1) }; }
    if (s.step > 0) return { ...s, step: s.step - 1 };
    return { ...blankState() };
  });

  const save = async (andSend) => {
    setErr('');
    if (!client.client_email.includes('@')) { setErr('A valid client email is required.'); return; }
    setSaving(true);
    try {
      const body = {
        client_name: client.client_name || null,
        client_email: client.client_email,
        company: client.company || null,
        category: S.cat,
        tier,
        line_items: items,
        answers: S.ans,
        notes: S.notes,
        total_cents: Math.round(total * 100),
        deposit_pct: 25,
      };
      const created = await api('/admin/quotes', { method: 'POST', body });
      if (andSend) {
        const sent = await api('/admin/quotes/' + created.quote.id + '/send', { method: 'POST' });
        setResult({ ...created, ...sent, sent: true });
      } else {
        setResult({ ...created, sent: false });
      }
      onSaved?.();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-xl rounded-2xl border border-slate-600 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-emerald-300">Quote {result.quote.public_id} saved</h3>
        <p className="mt-1 text-sm text-slate-400">{result.sent ? 'Emailed to ' + result.quote.client_email : 'Draft saved — not sent yet.'}</p>
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-sm">
          <p className="text-slate-300">Total: <b>{centsToUsd(result.quote.total_cents)}</b> · Deposit: <b>{centsToUsd(result.quote.deposit_cents)}</b></p>
          <p className="mt-2 break-all text-xs text-indigo-300">{result.link}</p>
        </div>
        <div className="mt-5 flex gap-2">
          <Btn onClick={() => navigator.clipboard?.writeText(result.link)}>Copy link</Btn>
          <Btn variant="ghost" onClick={onCancel}>Back to quotes</Btn>
        </div>
      </div>
    );
  }

  // Category picker.
  if (!S.cat) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">New quote — pick a category</h3>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => selCat(c.id)}
              className="rounded-xl border border-slate-600 bg-slate-900/60 p-5 text-left transition hover:border-indigo-400 hover:bg-slate-800">
              <div className="text-base font-semibold text-white">{c.l}</div>
              <div className="mt-1 text-sm text-slate-400">{c.d}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const runningTotal = total > 0 ? (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">Est. <b>{usd(total)}</b></span>
  ) : null;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-indigo-300">{S.cat} quote</span>
        <div className="flex items-center gap-3">{runningTotal}<Btn variant="ghost" onClick={onCancel}>Cancel</Btn></div>
      </div>

      {!done && q && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <h3 className="text-lg font-semibold text-white">{q.q}</h3>
          {q.sub && <p className="mt-1 text-sm text-slate-400">{q.sub}</p>}

          <div className="mt-4 space-y-2">
            {q.t === 'single' && q.opts.map((o) => (
              <button key={o.v} type="button" onClick={() => selSingle(q.id, o)}
                className={'block w-full rounded-xl border px-4 py-3 text-left transition ' + (S.ans[q.id] === o.v ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800')}>
                <div className="font-medium text-white">{o.l}</div>
                {o.d && <div className="text-sm text-slate-400">{o.d}</div>}
              </button>
            ))}
            {q.t === 'multi' && q.opts.map((o) => {
              const on = Array.isArray(S.ans[q.id]) && S.ans[q.id].includes(o.v);
              return (
                <button key={o.v} type="button" onClick={() => togMulti(q.id, o)}
                  className={'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ' + (on ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800')}>
                  <div>
                    <div className="font-medium text-white">{o.l}{o.inc && <span className="ml-2 text-xs text-emerald-400">(included)</span>}</div>
                    {o.d && <div className="text-sm text-slate-400">{o.d}</div>}
                  </div>
                  <span className={'grid h-5 w-5 place-items-center rounded border ' + (on ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-slate-500')}>{on ? '✓' : ''}</span>
                </button>
              );
            })}
            {q.t === 'text' && (
              <textarea className={inputCls()} rows={3} placeholder={q.ph || ''} value={S.ans[q.id] || ''} onChange={(e) => setText(q.id, e.target.value)} />
            )}
            {q.t === 'num' && (
              <div className="flex items-center gap-3">
                <Btn variant="ghost" onClick={() => setNum(q.id, (S.ans[q.id] || q.def || 1) - 1, q.min, q.max)}>−</Btn>
                <input type="number" className={inputCls('w-24 text-center')} min={q.min} max={q.max}
                  value={S.ans[q.id] || q.def || 1} onChange={(e) => setNum(q.id, Number(e.target.value), q.min, q.max)} />
                <Btn variant="ghost" onClick={() => setNum(q.id, (S.ans[q.id] || q.def || 1) + 1, q.min, q.max)}>+</Btn>
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-700 pt-3">
            <input className={inputCls('text-sm')} placeholder="Add a note for this step (optional)"
              value={S.notes[q.id] || ''} onChange={(e) => setNote(q.id, e.target.value)} />
          </div>

          <div className="mt-4 flex justify-between">
            <Btn variant="ghost" onClick={goBack}>Back</Btn>
            {q.t !== 'single' && <Btn onClick={nextQ}>Continue</Btn>}
          </div>
        </div>
      )}

      {done && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-5">
          <h3 className="text-lg font-semibold text-white">Review & send quote</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Client name"><input className={inputCls()} value={client.client_name} onChange={(e) => setClient({ ...client, client_name: e.target.value })} placeholder="Jane Smith" /></Field>
            <Field label="Client email *"><input className={inputCls()} type="email" value={client.client_email} onChange={(e) => setClient({ ...client, client_email: e.target.value })} placeholder="jane@example.com" /></Field>
            <Field label="Company"><input className={inputCls()} value={client.company} onChange={(e) => setClient({ ...client, company: e.target.value })} placeholder="Optional" /></Field>
          </div>

          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Summary</p>
            <div className="mt-2 space-y-1 text-sm">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between"><span className="text-slate-300">{it.n}</span><span className="text-slate-400">{usd(it.p)}{it.u ? '/' + it.u : ''}</span></div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-slate-700 pt-3 text-base font-semibold text-white"><span>Total</span><span>{usd(total)}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-200">Deposit (25%): <b>{usd(deposit)}</b></div>
              <div className="rounded-lg bg-slate-900/60 px-3 py-2 text-slate-300">On approval: <b>{usd(total - deposit)}</b></div>
            </div>
            {hostingLine(S) && (
              <p className="mt-3 text-xs text-slate-400">Hosting: ${hostingLine(S).monthly}/mo{hostingLine(S).billed === 'yearly' ? ` (billed $${hostingLine(S).yearly}/yr)` : ''}{hostingLine(S).fee ? ` · +${hostingLine(S).fee} platform fee` : ''}</p>
            )}
          </div>

          {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={goBack}>Back</Btn>
            <Btn variant="ghost" onClick={() => save(false)} className={saving ? 'opacity-50' : ''}>Save draft</Btn>
            <Btn onClick={() => save(true)} className={saving ? 'opacity-50' : ''}>Save & email client</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export function QuotesSection({ api, Btn, Table, Field, inputCls }) {
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('list');
  const [detail, setDetail] = useState(null);

  const load = () => api('/admin/quotes').then((r) => setRows(r.quotes || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const openDetail = async (row) => {
    const r = await api('/admin/quotes/' + row.id);
    setDetail({ ...r.quote, link: r.link });
  };

  const send = async (row) => {
    await api('/admin/quotes/' + row.id + '/send', { method: 'POST' });
    load();
    if (detail?.id === row.id) openDetail(row);
  };

  const statusPill = (r) => {
    const map = { draft: 'bg-slate-700 text-slate-300', sent: 'bg-indigo-900 text-indigo-300', paid: 'bg-emerald-900 text-emerald-300' };
    return <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (map[r.status] || map.draft)}>{r.status}</span>;
  };

  if (mode === 'build') {
    return (
      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">Quote builder</h2>
        <QuoteWizard api={api} Btn={Btn} Field={Field} inputCls={inputCls} onSaved={load} onCancel={() => { setMode('list'); load(); }} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Quotes</h2>
          <p className="mt-1 text-sm text-slate-400">Build a quote, email the client a pay link, and start their account on deposit.</p>
        </div>
        <Btn onClick={() => setMode('build')}>New quote</Btn>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Table
          columns={[
            { key: 'public_id', label: 'Quote', render: (r) => <span className="font-mono text-xs">{r.public_id}</span> },
            { key: 'client', label: 'Client', render: (r) => r.client_name || r.client_email },
            { key: 'total_cents', label: 'Total', render: (r) => centsToUsd(r.total_cents) },
            { key: 'status', label: 'Status', render: statusPill },
          ]}
          rows={rows}
          onView={openDetail}
          extraActions={(r) => r.status !== 'paid' ? (
            <Btn className="ml-2" onClick={() => send(r)}>{r.status === 'sent' ? 'Resend' : 'Send'}</Btn>
          ) : null}
          onEdit={openDetail}
          onDelete={async (r) => { if (confirm('Delete quote ' + r.public_id + '?')) { await api('/admin/quotes/' + r.id, { method: 'DELETE' }); load(); } }}
        />

        {detail && (
          <div className="rounded-xl border border-slate-500 bg-slate-800/80 p-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm text-white">{detail.public_id}</h3>
              {statusPill(detail)}
            </div>
            <dl className="mt-3 grid gap-1 text-sm text-slate-300">
              <div><span className="text-slate-500">Client:</span> {detail.client_name || '—'}</div>
              <div><span className="text-slate-500">Email:</span> {detail.client_email}</div>
              {detail.company && <div><span className="text-slate-500">Company:</span> {detail.company}</div>}
              <div><span className="text-slate-500">Category:</span> {detail.category} {detail.tier ? `· ${detail.tier}` : ''}</div>
            </dl>
            <div className="mt-3 rounded-lg bg-slate-900 p-3 text-sm">
              {(Array.isArray(detail.line_items) ? detail.line_items : []).map((it, i) => (
                <div key={i} className="flex justify-between"><span className="text-slate-300">{it.n}</span><span className="text-slate-400">{usd(it.p)}{it.u ? '/' + it.u : ''}</span></div>
              ))}
              <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-semibold text-white"><span>Total</span><span>{centsToUsd(detail.total_cents)}</span></div>
              <div className="mt-1 flex justify-between text-amber-200"><span>Deposit (25%)</span><span>{centsToUsd(detail.deposit_cents)}</span></div>
            </div>
            {detail.paid_at && <p className="mt-2 text-xs text-emerald-300">Paid {new Date(detail.paid_at).toLocaleString()}</p>}
            <p className="mt-3 break-all text-xs text-indigo-300">{detail.link}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn onClick={() => navigator.clipboard?.writeText(detail.link)}>Copy link</Btn>
              {detail.status !== 'paid' && <Btn variant="ghost" onClick={() => send(detail)}>{detail.status === 'sent' ? 'Resend email' : 'Send email'}</Btn>}
              <a className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm hover:bg-slate-800" href={detail.link} target="_blank" rel="noreferrer">Open</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
