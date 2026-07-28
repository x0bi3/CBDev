import React, { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_TYPES = [
  { id: 'service_industry_location', label: 'Service + Industry + Location' },
  { id: 'service_location', label: 'Service + Location' },
  { id: 'custom', label: 'Custom landing page' },
];

const SCHEMA_OPTIONS = ['LocalBusiness', 'ProfessionalService', 'Service', 'FAQPage'];
const TABS = ['Content', 'SEO', 'Links', 'Schema', 'Preview'];
const ASSIST_STAGES = [
  { id: 'sam', label: 'Sam — keywords + SEO pack…' },
  { id: 'mark', label: 'Mark — positioning brief…' },
  { id: 'cody', label: 'Cody — drafting sections…' },
  { id: 'media', label: 'Media — finding OG image…' },
  { id: 'done', label: 'Draft ready — review below, then Save' },
];

/** Render SEO body with paragraphs + bullet/numbered lists (matches www). */
function normalizeListMarkup(body) {
  let text = String(body || '').replace(/\r\n/g, '\n');
  text = text.replace(/:\s*([-*•])\s+/g, ':\n$1 ');
  text = text.replace(/:\s*(\d+[.)])\s+/g, ':\n$1 ');
  text = text.replace(/([.!;])\s+([-*•])\s+/g, '$1\n$2 ');
  text = text.replace(/([.!;])\s+(\d+[.)])\s+/g, '$1\n$2 ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function isAllowedInternalPath(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return false;
  const pathOnly = raw.split('?')[0].split('#')[0];
  const segments = pathOnly.split('/').filter(Boolean);
  const exact = new Set([
    'pricing',
    'book',
    'inquiry',
    'vibe-check',
    'process',
    'work',
    'faq',
    'audit',
    'one-time',
    'contact',
    'about',
    'team',
    'services',
    'earlybirdcampaign',
  ]);
  if (segments.length === 0) return true;
  if (segments.length === 1 && exact.has(segments[0])) return true;
  if (segments.length === 2 && segments[0] === 'services') return true;
  if (segments.length === 2 && segments[0] === 'work') return true;
  if (segments[0] === 'services' && segments.length === 3) return /-area$/.test(segments[2]);
  if (segments[0] === 'services' && segments.length === 4) return /-area$/.test(segments[3]);
  return false;
}

function renderInlineMarkdown(text) {
  const nodes = [];
  const re = /(\[[^\]]+\]\((\/[^)\s]+)\)|\*\*[^*]+?\*\*|\*[^*]+?\*)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const link = token.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/);
    if (link) {
      const label = link[1];
      const href = link[2];
      if (isAllowedInternalPath(href)) {
        nodes.push(
          <a key={key++} href={href} className="text-indigo-300 underline-offset-2 hover:underline">
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={key++} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++} className="italic">{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

function RichBody({ body }) {
  const lines = normalizeListMarkup(body).split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    const text = para.join(' ').trim();
    if (text) blocks.push({ type: 'p', text });
    para = [];
  };
  const flushList = () => {
    if (list?.items?.length) blocks.push(list);
    list = null;
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      flushPara();
      flushList();
      continue;
    }
    const ul = t.match(/^[-*•]\s+(.+)$/);
    const ol = t.match(/^\d+[.)]\s+(.+)$/);
    if (ul) {
      flushPara();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    if (ol) {
      flushPara();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  if (!blocks.length) return null;
  return (
    <div className="mt-2 space-y-3 text-slate-300">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i} className="leading-relaxed">{renderInlineMarkdown(b.text)}</p>;
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((item) => <li key={item}>{renderInlineMarkdown(item)}</li>)}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.items.map((item) => <li key={item}>{renderInlineMarkdown(item)}</li>)}
          </ol>
        );
      })}
    </div>
  );
}

function statusCls(status) {
  if (status === 'published') return 'bg-emerald-900/60 text-emerald-300';
  if (status === 'review') return 'bg-amber-900/60 text-amber-200';
  return 'bg-slate-700 text-slate-300';
}

function buildLocalPath(pageType, service, industry, location, customPath) {
  if (pageType === 'custom') {
    const p = (customPath || '').trim();
    if (!p) return '/services/...';
    return p.startsWith('/') ? p : `/${p}`;
  }
  if (!service?.slug || !location?.slug) return '—';
  const loc = location.slug.endsWith('-area') ? location.slug : `${location.slug}-area`;
  if (pageType === 'service_location') return `/services/${service.slug}/${loc}`;
  if (!industry?.slug) return `/services/${service.slug}/…/${loc}`;
  return `/services/${service.slug}/${industry.slug}/${loc}`;
}

export function ContentEngineSection({ api, Btn, Table, Field, inputCls }) {
  const [taxonomies, setTaxonomies] = useState([]);
  const [pages, setPages] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('list'); // list | create | edit
  const [bundle, setBundle] = useState(null);
  const [tab, setTab] = useState('Content');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // AI Assist
  const [assistRunning, setAssistRunning] = useState(false);
  const [assistStage, setAssistStage] = useState(null);
  const [assistProposal, setAssistProposal] = useState(null);
  const [assistRationale, setAssistRationale] = useState(null);
  const [caseStudies, setCaseStudies] = useState([]);
  const [selectedCaseSlugs, setSelectedCaseSlugs] = useState([]);
  const [caseStudyQuery, setCaseStudyQuery] = useState('');
  const [caseStudyMenuOpen, setCaseStudyMenuOpen] = useState(false);
  const [caseStudiesLoaded, setCaseStudiesLoaded] = useState(false);

  // Target builder
  const [pageType, setPageType] = useState('service_industry_location');
  const [serviceId, setServiceId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [customPath, setCustomPath] = useState('');

  const services = useMemo(() => taxonomies.filter((t) => t.kind === 'service'), [taxonomies]);
  const industries = useMemo(() => taxonomies.filter((t) => t.kind === 'industry'), [taxonomies]);
  const locations = useMemo(() => taxonomies.filter((t) => t.kind === 'location'), [taxonomies]);

  const service = services.find((s) => String(s.id) === String(serviceId));
  const industry = industries.find((s) => String(s.id) === String(industryId));
  const location = locations.find((s) => String(s.id) === String(locationId));
  const previewPath = buildLocalPath(pageType, service, industry, location, customPath);

  const loadList = useCallback(async () => {
    const q = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') q.set('status', statusFilter);
    if (search.trim()) q.set('q', search.trim());
    const r = await api('/admin/content-engine/pages?' + q.toString());
    setPages(r.pages || []);
  }, [api, statusFilter, search]);

  const loadTaxonomies = useCallback(async () => {
    const r = await api('/admin/content-engine/taxonomies');
    setTaxonomies(r.taxonomies || []);
  }, [api]);

  useEffect(() => {
    loadTaxonomies().catch((e) => setError(e.message));
  }, [loadTaxonomies]);

  useEffect(() => {
    if (mode === 'list') loadList().catch((e) => setError(e.message));
  }, [mode, loadList]);

  const loadCaseStudies = useCallback(async () => {
    setCaseStudiesLoaded(false);
    try {
      const cs = await api('/admin/content-engine/case-studies');
      setCaseStudies(cs.case_studies || []);
    } catch {
      setCaseStudies([]);
    } finally {
      setCaseStudiesLoaded(true);
    }
  }, [api]);

  const openEdit = async (row) => {
    setError('');
    const r = await api('/admin/content-engine/pages/' + row.id);
    setBundle(r);
    setMode('edit');
    setTab('Content');
    setSelectedCaseSlugs([]);
    setCaseStudyQuery('');
    setCaseStudyMenuOpen(false);
    await loadCaseStudies();
  };

  const createDraft = async () => {
    setError('');
    setSaving(true);
    try {
      const body = {
        page_type: pageType,
        service_id: serviceId ? Number(serviceId) : null,
        industry_id: pageType === 'service_industry_location' && industryId ? Number(industryId) : null,
        location_id: locationId ? Number(locationId) : null,
        path: pageType === 'custom' ? customPath : undefined,
      };
      const r = await api('/admin/content-engine/pages', { method: 'POST', body });
      setBundle(r);
      setMode('edit');
      setTab('Content');
      setSelectedCaseSlugs([]);
      setCaseStudyQuery('');
      setCaseStudyMenuOpen(false);
      await loadCaseStudies();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const savePage = async (extra = {}) => {
    if (!bundle?.page) return;
    setSaving(true);
    setError('');
    try {
      const page = { ...bundle.page, ...extra };
      const r = await api('/admin/content-engine/pages/' + page.id, {
        method: 'PUT',
        body: {
          ...page,
          sections: bundle.sections,
          links: bundle.links,
        },
      });
      setBundle(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!bundle?.page) return;
    await savePage();
    setSaving(true);
    try {
      const r = await api('/admin/content-engine/pages/' + bundle.page.id + '/publish', { method: 'POST' });
      setBundle(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updatePageField = (key, value) => {
    setBundle((prev) => ({ ...prev, page: { ...prev.page, [key]: value } }));
  };

  const updateSection = (idx, key, value) => {
    setBundle((prev) => {
      const sections = [...prev.sections];
      sections[idx] = { ...sections[idx], [key]: value };
      return { ...prev, sections };
    });
  };

  const addSection = () => {
    setBundle((prev) => ({
      ...prev,
      sections: [...prev.sections, { section_type: 'body', heading: 'New section', body: '' }],
    }));
  };

  const moveSection = (idx, dir) => {
    setBundle((prev) => {
      const sections = [...prev.sections];
      const j = idx + dir;
      if (j < 0 || j >= sections.length) return prev;
      [sections[idx], sections[j]] = [sections[j], sections[idx]];
      return { ...prev, sections };
    });
  };

  const removeSection = (idx) => {
    setBundle((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== idx),
    }));
  };

  const addLink = () => {
    setBundle((prev) => ({
      ...prev,
      links: [...(prev.links || []), { label: '', target_url: '', rel: 'related' }],
    }));
  };

  const updateLink = (idx, key, value) => {
    setBundle((prev) => {
      const links = [...(prev.links || [])];
      links[idx] = { ...links[idx], [key]: value };
      return { ...prev, links };
    });
  };

  const removeLink = (idx) => {
    setBundle((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== idx),
    }));
  };

  const toggleSchema = (type) => {
    const current = Array.isArray(bundle.page.schema_types) ? bundle.page.schema_types : [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    updatePageField('schema_types', next);
  };

  const openMatrix = async () => {
    setError('');
    const r = await api('/admin/content-engine/matrix');
    setMatrix(r);
    setMatrixOpen(true);
  };

  const createFromMatrix = (svc, ind, loc) => {
    setPageType('service_industry_location');
    setServiceId(String(svc.id));
    setIndustryId(String(ind.id));
    setLocationId(String(loc.id));
    setMatrixOpen(false);
    setMode('create');
  };

  const findMatrixPage = (svcId, indId, locId) =>
    (matrix?.pages || []).find(
      (p) => p.service_id === svcId && p.industry_id === indId && p.location_id === locId,
    );

  const discardAssist = () => {
    setAssistProposal(null);
    setAssistRationale(null);
    setAssistStage(null);
  };

  const runAiAssist = async () => {
    if (!bundle?.page?.id || assistRunning) return;
    setError('');
    setAssistRunning(true);
    setAssistProposal(null);
    setAssistRationale(null);
    setAssistStage('sam');

    const stageOrder = ['sam', 'mark', 'cody', 'media'];
    let stageIdx = 0;
    const tick = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stageOrder.length - 1);
      setAssistStage(stageOrder[stageIdx]);
    }, 4500);

    try {
      const r = await api('/admin/content-engine/pages/' + bundle.page.id + '/ai-assist', {
        method: 'POST',
        body: {
          case_study_slugs: selectedCaseSlugs,
        },
      });
      clearInterval(tick);
      setAssistStage('done');
      setAssistProposal(r.proposal || null);
      setAssistRationale(r.rationale || null);
    } catch (e) {
      clearInterval(tick);
      setAssistStage(null);
      setError(e.message || 'AI Assist failed');
    } finally {
      setAssistRunning(false);
    }
  };

  const applyAssist = () => {
    if (!assistProposal || !bundle?.page) return;
    if (bundle.page.status === 'published') {
      const ok = window.confirm(
        'This page is published. Apply AI draft to the form anyway? (Still needs Save — does not auto-publish changes.)',
      );
      if (!ok) return;
    }
    const p = assistProposal;
    setBundle((prev) => ({
      ...prev,
      page: {
        ...prev.page,
        title: p.title ?? prev.page.title,
        h1: p.h1 ?? prev.page.h1,
        intro: p.intro ?? prev.page.intro,
        seo_title: p.seo_title ?? prev.page.seo_title,
        seo_description: p.seo_description ?? prev.page.seo_description,
        og_image_url: p.og_image_url || prev.page.og_image_url || '',
        schema_types: p.schema_types ?? prev.page.schema_types,
        schema_json: p.schema_json ?? prev.page.schema_json,
      },
      sections: Array.isArray(p.sections) ? p.sections : prev.sections,
      links: Array.isArray(p.links) ? p.links : prev.links,
      word_count: undefined,
    }));
    setTab('Preview');
    discardAssist();
  };

  // ——— LIST ———
  if (mode === 'list') {
    return (
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Content Engine</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage, create, and publish SEO pages — service × industry × location
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={openMatrix}>Content Matrix</Btn>
            <Btn onClick={() => { setMode('create'); setError(''); }}>Create Page</Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            className={inputCls('min-w-[220px] flex-1')}
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadList()}
          />
          <select className={inputCls()} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="published">Published</option>
          </select>
          <Btn variant="ghost" onClick={() => loadList()}>Filter</Btn>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <Table
          columns={[
            { key: 'title', label: 'Title', wrap: true },
            { key: 'path', label: 'Path' },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span className={'rounded px-2 py-0.5 text-xs ' + statusCls(r.status)}>{r.status}</span>
              ),
            },
            {
              key: 'target',
              label: 'Target',
              render: (r) => [r.service_name, r.industry_name, r.location_name].filter(Boolean).join(' · ') || '—',
            },
            {
              key: 'updated_at',
              label: 'Updated',
              render: (r) => (r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—'),
            },
          ]}
          rows={pages}
          onEdit={openEdit}
          onDelete={async (r) => {
            if (!confirm('Delete this SEO page?')) return;
            await api('/admin/content-engine/pages/' + r.id, { method: 'DELETE' });
            loadList();
          }}
        />

        {matrixOpen && matrix && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setMatrixOpen(false)}>
            <div
              className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-600 bg-slate-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Content Matrix</h3>
                <Btn variant="ghost" onClick={() => setMatrixOpen(false)}>Close</Btn>
              </div>
              <p className="mb-4 text-sm text-slate-400">
                ● published · ◐ draft · ○ opportunity (click to create)
              </p>
              {(matrix.services || []).map((svc) => (
                <div key={svc.id} className="mb-8">
                  <h4 className="mb-2 font-medium text-indigo-300">{svc.name}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="px-2 py-2">Industry</th>
                          {(matrix.locations || []).map((loc) => (
                            <th key={loc.id} className="px-2 py-2 whitespace-nowrap">{loc.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(matrix.industries || []).map((ind) => (
                          <tr key={ind.id} className="border-t border-slate-800">
                            <td className="px-2 py-2 whitespace-nowrap">{ind.name}</td>
                            {(matrix.locations || []).map((loc) => {
                              const existing = findMatrixPage(svc.id, ind.id, loc.id);
                              return (
                                <td key={loc.id} className="px-2 py-2 text-center">
                                  {existing ? (
                                    <button
                                      type="button"
                                      className="text-lg"
                                      title={existing.title}
                                      onClick={() => { setMatrixOpen(false); openEdit(existing); }}
                                    >
                                      {existing.status === 'published' ? '●' : '◐'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="text-lg text-slate-600 hover:text-indigo-300"
                                      onClick={() => createFromMatrix(svc, ind, loc)}
                                    >
                                      ○
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ——— CREATE ———
  if (mode === 'create') {
    return (
      <div className="min-w-0 max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Create SEO page</h2>
            <p className="mt-1 text-sm text-slate-400">Pick the target, create a draft, then use AI Assist to fill copy</p>
          </div>
          <Btn variant="ghost" onClick={() => setMode('list')}>Back</Btn>
        </div>

        <Field label="Page type">
          <div className="space-y-2">
            {PAGE_TYPES.map((pt) => (
              <label key={pt.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="pageType"
                  checked={pageType === pt.id}
                  onChange={() => setPageType(pt.id)}
                />
                {pt.label}
              </label>
            ))}
          </div>
        </Field>

        {pageType !== 'custom' && (
          <>
            <Field label="What are you selling?">
              <select className={inputCls('w-full')} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Select service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {pageType === 'service_industry_location' && (
              <Field label="Who are you helping?">
                <select className={inputCls('w-full')} value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
                  <option value="">Select industry…</option>
                  {industries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Where?">
              <select className={inputCls('w-full')} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Select location…</option>
                {locations.map((s) => <option key={s.id} value={s.id}>{s.name}, Wisconsin</option>)}
              </select>
            </Field>
          </>
        )}

        {pageType === 'custom' && (
          <Field label="Custom path (under /services/…)">
            <input
              className={inputCls('w-full')}
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/services/websites/custom-landing"
            />
          </Field>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">URL preview</p>
          <p className="mt-1 font-mono text-sm text-indigo-300">{previewPath}</p>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <Btn
          onClick={createDraft}
          className="disabled:opacity-50"
          disabled={
            saving ||
            (pageType !== 'custom' && (!serviceId || !locationId || (pageType === 'service_industry_location' && !industryId))) ||
            (pageType === 'custom' && !customPath.trim())
          }
        >
          {saving ? 'Creating…' : 'Create draft'}
        </Btn>
      </div>
    );
  }

  // ——— EDIT ———
  if (!bundle?.page) return <p className="text-slate-400">Loading…</p>;
  const page = bundle.page;
  const wordCount =
    bundle.word_count ??
    [page.h1, page.intro, ...(bundle.sections || []).flatMap((s) => [s.heading, s.body])]
      .join(' ')
      .split(/\s+/)
      .filter(Boolean).length;

  const assistStageIdx = ASSIST_STAGES.findIndex((s) => s.id === assistStage);

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="text-sm text-slate-400 hover:text-white" onClick={() => { discardAssist(); setMode('list'); }}>
            ← All pages
          </button>
          <h2 className="mt-1 text-xl font-semibold text-white">{page.title || 'Untitled'}</h2>
          <p className="font-mono text-xs text-slate-500">{page.path}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn
            onClick={runAiAssist}
            className="disabled:opacity-50"
            disabled={assistRunning || saving}
          >
            {assistRunning ? 'AI Assist…' : 'AI Assist'}
          </Btn>
          <span className={'rounded px-2 py-1 text-xs ' + statusCls(page.status)}>{page.status}</span>
        </div>
      </div>

      {caseStudiesLoaded && (
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
          <p className="text-sm font-medium text-white">Include published case studies</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Optional. Search and pick live /work studies — AI Assist uses their problem, build, results, links, and image tone.
          </p>

          {!!selectedCaseSlugs.length && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {selectedCaseSlugs.map((slug) => {
                const cs = caseStudies.find((c) => c.slug === slug);
                if (!cs) return null;
                return (
                  <li
                    key={slug}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-700/50 bg-indigo-950/50 px-3 py-1 text-xs text-indigo-100"
                  >
                    <span>{cs.name}</span>
                    <button
                      type="button"
                      className="text-indigo-300 hover:text-white"
                      disabled={assistRunning}
                      onClick={() => setSelectedCaseSlugs((prev) => prev.filter((s) => s !== slug))}
                      aria-label={`Remove ${cs.name}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="relative mt-3">
            <input
              className={inputCls('w-full')}
              placeholder="Search published case studies… (e.g. RidgeLine HVAC)"
              value={caseStudyQuery}
              disabled={assistRunning}
              onChange={(e) => {
                setCaseStudyQuery(e.target.value);
                setCaseStudyMenuOpen(true);
              }}
              onFocus={() => setCaseStudyMenuOpen(true)}
              onBlur={() => {
                // allow click on option before close
                setTimeout(() => setCaseStudyMenuOpen(false), 150);
              }}
            />
            {caseStudyMenuOpen && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl">
                {caseStudies
                  .filter((cs) => {
                    if (selectedCaseSlugs.includes(cs.slug)) return false;
                    const q = caseStudyQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      cs.name.toLowerCase().includes(q) ||
                      cs.category.toLowerCase().includes(q) ||
                      cs.slug.toLowerCase().includes(q) ||
                      String(cs.summary || '').toLowerCase().includes(q) ||
                      String(cs.tag || '').toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 12)
                  .map((cs) => (
                    <li key={cs.slug}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-950/60"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCaseSlugs((prev) => [...prev, cs.slug]);
                          setCaseStudyQuery('');
                          setCaseStudyMenuOpen(false);
                        }}
                      >
                        <span className="font-medium text-slate-100">{cs.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {cs.category} · {cs.path}
                        </span>
                      </button>
                    </li>
                  ))}
                {!caseStudies.filter((cs) => {
                  if (selectedCaseSlugs.includes(cs.slug)) return false;
                  const q = caseStudyQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    cs.name.toLowerCase().includes(q) ||
                    cs.category.toLowerCase().includes(q) ||
                    cs.slug.toLowerCase().includes(q) ||
                    String(cs.summary || '').toLowerCase().includes(q)
                  );
                }).length && (
                  <li className="px-3 py-2 text-xs text-slate-500">No matching published studies</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {(assistRunning || assistProposal) && (
        <div className="rounded-xl border border-indigo-800/60 bg-indigo-950/40 p-4">
          <p className="text-sm font-medium text-indigo-200">AI Assist</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {ASSIST_STAGES.map((s, i) => {
              const done = assistStageIdx > i || (assistStage === 'done' && s.id !== 'done');
              const active = assistStage === s.id;
              const mark = done || (assistStage === 'done' && s.id === 'done') ? '✓' : active ? '●' : '○';
              const cls = done || (assistStage === 'done' && s.id === 'done')
                ? 'text-emerald-300'
                : active
                  ? 'text-indigo-200'
                  : 'text-slate-500';
              return (
                <li key={s.id} className={cls}>
                  {mark} {s.label}
                </li>
              );
            })}
          </ul>

          {assistRationale && (
            <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-900/50 p-3 text-xs text-slate-300 space-y-2">
              <p><span className="text-slate-500">Primary keyword:</span> {assistRationale.primary_keyword || '—'}</p>
              {!!assistRationale.secondary_keywords?.length && (
                <p><span className="text-slate-500">Secondary:</span> {assistRationale.secondary_keywords.join(', ')}</p>
              )}
              {assistRationale.angle && (
                <p><span className="text-slate-500">Angle:</span> {assistRationale.angle}</p>
              )}
              {assistRationale.word_count != null && (
                <p><span className="text-slate-500">Draft words:</span> {assistRationale.word_count}</p>
              )}
              {!!assistRationale.case_studies?.length && (
                <p>
                  <span className="text-slate-500">Case studies:</span>{' '}
                  {assistRationale.case_studies.map((c) => c.name).join(', ')}
                </p>
              )}
              {(assistRationale.image_url || assistProposal?.og_image_url) && (
                <div className="pt-1">
                  <p className="text-slate-500 mb-1">
                    OG image{assistRationale.image_credit ? ` — ${assistRationale.image_credit}` : ''}
                  </p>
                  <img
                    src={assistRationale.image_url || assistProposal.og_image_url}
                    alt="Proposed OG"
                    className="max-h-36 w-full rounded-lg object-cover border border-slate-700"
                  />
                </div>
              )}
              {!assistRationale.image_url && !assistProposal?.og_image_url && assistStage === 'done' && (
                <p className="text-amber-300">No stock image found (check Pexels/Unsplash keys).</p>
              )}
            </div>
          )}

          {assistProposal && !assistRunning && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn onClick={applyAssist}>Apply to form</Btn>
              <Btn variant="ghost" onClick={discardAssist}>Discard</Btn>
              <Btn variant="ghost" onClick={runAiAssist} disabled={assistRunning}>Regenerate</Btn>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'rounded-lg px-3 py-2 text-sm ' +
                  (tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800')
                }
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Content' && (
            <div className="space-y-4">
              <Field label="Page title">
                <input className={inputCls('w-full')} value={page.title || ''} onChange={(e) => updatePageField('title', e.target.value)} />
              </Field>
              <Field label="H1">
                <input className={inputCls('w-full')} value={page.h1 || ''} onChange={(e) => updatePageField('h1', e.target.value)} />
              </Field>
              <Field label="Introduction">
                <textarea className={inputCls('w-full min-h-[100px]')} value={page.intro || ''} onChange={(e) => updatePageField('intro', e.target.value)} />
              </Field>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-300">Sections</h3>
                  <Btn variant="ghost" onClick={addSection}>+ Add section</Btn>
                </div>
                {(bundle.sections || []).map((sec, idx) => (
                  <div key={sec.id || idx} className="rounded-xl border border-slate-700 p-4">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <input
                        className={inputCls('flex-1 min-w-[180px]')}
                        value={sec.heading || ''}
                        onChange={(e) => updateSection(idx, 'heading', e.target.value)}
                        placeholder="Heading"
                      />
                      <input
                        className={inputCls('w-32')}
                        value={sec.section_type || ''}
                        onChange={(e) => updateSection(idx, 'section_type', e.target.value)}
                        placeholder="type"
                      />
                      <Btn variant="ghost" onClick={() => moveSection(idx, -1)}>↑</Btn>
                      <Btn variant="ghost" onClick={() => moveSection(idx, 1)}>↓</Btn>
                      <Btn variant="danger" onClick={() => removeSection(idx)}>Remove</Btn>
                    </div>
                    <textarea
                      className={inputCls('w-full min-h-[90px]')}
                      value={sec.body || ''}
                      onChange={(e) => updateSection(idx, 'body', e.target.value)}
                      placeholder="Section body"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'SEO' && (
            <div className="space-y-4">
              <Field label="SEO title">
                <input className={inputCls('w-full')} value={page.seo_title || ''} onChange={(e) => updatePageField('seo_title', e.target.value)} />
              </Field>
              <Field label="Meta description">
                <textarea className={inputCls('w-full min-h-[80px]')} value={page.seo_description || ''} onChange={(e) => updatePageField('seo_description', e.target.value)} />
              </Field>
              <Field label="Canonical path">
                <input className={inputCls('w-full')} value={page.canonical || ''} onChange={(e) => updatePageField('canonical', e.target.value)} />
              </Field>
              <Field label="Path (URL)">
                <input className={inputCls('w-full font-mono text-sm')} value={page.path || ''} onChange={(e) => updatePageField('path', e.target.value)} />
              </Field>
              <Field label="Robots">
                <select className={inputCls('w-full')} value={page.robots || 'index,follow'} onChange={(e) => updatePageField('robots', e.target.value)}>
                  <option value="index,follow">Index, Follow</option>
                  <option value="noindex,follow">Noindex, Follow</option>
                  <option value="noindex,nofollow">Noindex, Nofollow</option>
                </select>
              </Field>
              <Field label="OG image URL">
                <input className={inputCls('w-full')} value={page.og_image_url || ''} onChange={(e) => updatePageField('og_image_url', e.target.value)} />
              </Field>
              {page.og_image_url ? (
                <img
                  src={page.og_image_url}
                  alt="OG preview"
                  className="max-h-40 w-full rounded-xl object-cover border border-slate-700"
                />
              ) : null}
              <p className="text-xs text-slate-500">SEO score automation — Later</p>
            </div>
          )}

          {tab === 'Links' && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <h3 className="text-sm font-medium">Internal links</h3>
                <Btn variant="ghost" onClick={addLink}>+ Add link</Btn>
              </div>
              {(bundle.links || []).map((link, idx) => (
                <div key={idx} className="flex flex-wrap gap-2 rounded-xl border border-slate-700 p-3">
                  <input className={inputCls('flex-1 min-w-[120px]')} placeholder="Label" value={link.label || ''} onChange={(e) => updateLink(idx, 'label', e.target.value)} />
                  <input className={inputCls('flex-[2] min-w-[180px]')} placeholder="/services/…" value={link.target_url || ''} onChange={(e) => updateLink(idx, 'target_url', e.target.value)} />
                  <Btn variant="danger" onClick={() => removeLink(idx)}>Remove</Btn>
                </div>
              ))}
              {!bundle.links?.length && <p className="text-sm text-slate-500">No links yet.</p>}
            </div>
          )}

          {tab === 'Schema' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Select types — JSON-LD regenerates on save.</p>
              <div className="flex flex-wrap gap-3">
                {SCHEMA_OPTIONS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(page.schema_types || []).includes(t)}
                      onChange={() => toggleSchema(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl bg-black/40 p-3 text-xs text-slate-300">
                {JSON.stringify(page.schema_json || {}, null, 2)}
              </pre>
            </div>
          )}

          {tab === 'Preview' && (
            <div className="ce-prose rounded-xl border border-slate-700 bg-slate-900/40 p-6">
              {page.og_image_url ? (
                <img
                  src={page.og_image_url}
                  alt=""
                  className="mb-6 max-h-52 w-full rounded-xl object-cover border border-slate-700"
                />
              ) : null}
              <h1 className="text-2xl font-bold text-white">{page.h1 || page.title}</h1>
              {page.intro && <p className="mt-3 text-slate-300">{page.intro}</p>}
              {(bundle.sections || []).map((sec, i) => (
                <section key={i} className="mt-6">
                  {sec.heading && <h2 className="text-lg font-semibold text-white">{sec.heading}</h2>}
                  {sec.body && <RichBody body={sec.body} />}
                </section>
              ))}
              {(bundle.links || []).length > 0 && (
                <div className="mt-8 border-t border-slate-700 pt-4">
                  <p className="text-xs uppercase text-slate-500">Related</p>
                  <ul className="mt-2 space-y-1">
                    {bundle.links.map((l, i) => (
                      <li key={i} className="text-indigo-300">{l.label || l.target_url}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 xl:sticky xl:top-4 xl:self-start">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Page status</p>
            <p className="mt-1 font-medium capitalize">{page.status}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-slate-500">Word count</dt><dd className="text-lg font-semibold">{wordCount}</dd></div>
            <div><dt className="text-slate-500">Sections</dt><dd className="text-lg font-semibold">{bundle.sections?.length || 0}</dd></div>
            <div><dt className="text-slate-500">Links</dt><dd className="text-lg font-semibold">{bundle.links?.length || 0}</dd></div>
            <div><dt className="text-slate-500">Schema</dt><dd className="text-lg font-semibold">{(page.schema_types || []).length ? '✓' : '—'}</dd></div>
          </dl>
          <div className="space-y-2 border-t border-slate-700 pt-4 text-sm text-slate-400">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!page.publish_flags?.sitemap} onChange={(e) => updatePageField('publish_flags', { ...(page.publish_flags || {}), sitemap: e.target.checked })} /> Sitemap</label>
            <label className="flex items-center gap-2 opacity-50" title="Later"><input type="checkbox" disabled /> IndexNow (Later)</label>
            <label className="flex items-center gap-2 opacity-50" title="Later"><input type="checkbox" disabled /> Google Search Console (Later)</label>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Btn onClick={() => savePage()} className="disabled:opacity-50" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</Btn>
            <Btn onClick={publish} className="disabled:opacity-50" disabled={saving}>Publish</Btn>
            {page.status === 'published' && (
              <Btn
                variant="ghost"
                onClick={async () => {
                  const r = await api('/admin/content-engine/pages/' + page.id + '/unpublish', { method: 'POST' });
                  setBundle(r);
                }}
              >
                Unpublish
              </Btn>
            )}
            <a
              className="text-center text-sm text-indigo-300 hover:underline"
              href={'https://www.creativebuilds.dev' + page.path}
              target="_blank"
              rel="noreferrer"
            >
              Open on www →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ContentEngineSection;
