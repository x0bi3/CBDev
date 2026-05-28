import './standalone.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, Reorder } from 'framer-motion';

/* ========================= THEMES ========================= */
const themes = {
  'liquid-glass': {
    id:'liquid-glass', name:'Liquid Glass',
    wallpaper:
      'radial-gradient(120% 80% at 20% 10%,#6ea8ff 0%,transparent 55%),' +
      'radial-gradient(100% 70% at 80% 30%,#c084fc 0%,transparent 60%),' +
      'radial-gradient(140% 90% at 50% 110%,#ff7ab6 0%,transparent 60%),' +
      'linear-gradient(180deg,#0b1026 0%,#1a0b2e 100%)',
    orbs:['#6ea8ff','#c084fc','#ff7ab6'],
  },
  'sunset': {
    id:'sunset', name:'Sunset',
    wallpaper:
      'radial-gradient(120% 80% at 30% 0%,#ffb37a 0%,transparent 55%),' +
      'radial-gradient(100% 80% at 80% 60%,#ff5e87 0%,transparent 60%),' +
      'linear-gradient(180deg,#3b0a45 0%,#7a1e3a 60%,#c2410c 100%)',
    orbs:['#ffb37a','#ff5e87','#fbbf24'],
  },
  'midnight': {
    id:'midnight', name:'Midnight',
    wallpaper:
      'radial-gradient(80% 60% at 70% 20%,#1e3a8a 0%,transparent 60%),' +
      'radial-gradient(100% 80% at 20% 90%,#0f172a 0%,transparent 70%),' +
      'linear-gradient(180deg,#020617 0%,#050816 100%)',
    orbs:['#3b82f6','#6366f1','#8b5cf6'],
  },
  'aqua': {
    id:'aqua', name:'Aqua',
    wallpaper:
      'radial-gradient(80% 60% at 20% 10%,#22d3ee 0%,transparent 55%),' +
      'radial-gradient(100% 80% at 80% 80%,#14b8a6 0%,transparent 60%),' +
      'linear-gradient(180deg,#052e3a 0%,#0e7490 60%,#0891b2 100%)',
    orbs:['#22d3ee','#14b8a6','#67e8f9'],
  },
};
const themeOrder = ['liquid-glass','sunset','midnight','aqua'];

/* ========================= EYE ICON ========================= */
const eyes = {
  outline: { name:'Outline', svg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )},
  scanner: { name:'Scanner', svg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="currentColor" fillOpacity="0.25"/>
      <circle cx="12" cy="12" r="3.2" fill="currentColor"/>
      <path d="M3 12h6M15 12h6" />
    </svg>
  )},
  abstract: { name:'Abstract', svg: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
    </svg>
  )},
};
const eyeOrder = ['outline','scanner','abstract'];

/* ========================= CONTEXT ========================= */
const DeviceCtx = createContext(null);
const useDevice = () => useContext(DeviceCtx);

/* ========================= DEBUG LOGGING ========================= */
// Bump LOG_VERSION on every meaningful change so we can verify in the
// console that the user is actually running the latest build. Format: v<major>.<minor>.
// Debug logging is on by default during this debug window so the user does not need
// to flip a flag. Disable with localStorage.setItem('cb-debug','0').
const LOG_VERSION = 'v2.1';
const CB_DEBUG = (() => {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location && window.location.search.includes('debug=0')) return false;
    if (localStorage.getItem('cb-debug') === '0') return false;
    return true;
  } catch { return true; }
})();
const cbStart = (typeof performance !== 'undefined' ? performance.now() : 0);
const log = (event, data) => {
  if (!CB_DEBUG) return;
  const t = ((typeof performance !== 'undefined' ? performance.now() : 0) - cbStart).toFixed(0);
  if (data !== undefined) console.log(`[CB ${LOG_VERSION} ${t}ms] ${event}`, data);
  else console.log(`[CB ${LOG_VERSION} ${t}ms] ${event}`);
};
if (typeof window !== 'undefined' && CB_DEBUG) {
  console.log(`%c[CB ${LOG_VERSION}] debug logging ENABLED. Reproduce the stuck state, then copy every [CB ${LOG_VERSION} ...] line.`,
    'background:#111;color:#0f0;padding:2px 6px;border-radius:4px;font-weight:bold');
}

function DeviceProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('iphone-portfolio:theme') || 'liquid-glass');
  const [eyeId, setEyeId] = useState(() => localStorage.getItem('iphone-portfolio:eye') || 'outline');
  const [homePage, setHomePage] = useState(0);
  const [openAppId, setOpenAppId] = useState(null);
  const [prevAppId, setPrevAppId] = useState(null);
  const [ccOpen, setCcOpen] = useState(false);
  const profileBtnRef = useRef(null);
  const themeBtnRef = useRef(null);
  const musicBtnRef = useRef(null);
  // Global music state (lifted out of MusicApp so playback persists across navigation)
  const audioRef = useRef(null);
  const [musicCurrent, setMusicCurrent] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolumeState] = useState(0.6);
  const [musicStatus, setMusicStatus] = useState('idle'); // idle | loading | playing | error
  const [miniPlayerOpen, setMiniPlayerOpen] = useState(false);
  // When true, AppView's swipe-to-dismiss drag is disabled. Used by volume sliders
  // (and any other in-app control) to guarantee their gesture never accidentally
  // closes the host app, even if the pointer drifts off the control during a drag.
  const [dragLocked, setDragLocked] = useState(false);
  const lockDrag   = useCallback(() => setDragLocked(true),  []);
  const unlockDrag = useCallback(() => setDragLocked(false), []);
  const [appOrder, setAppOrderState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('iphone-portfolio:app-order') || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (_) { /* ignore */ }
    return null; // null = use defaults from homeApps
  });
  const [auth, setAuthState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('iphone-portfolio:auth') || 'null');
      if (saved && saved.email) return saved;
    } catch (_) { /* ignore */ }
    return null;
  });
  const [authOpen, setAuthOpen] = useState(false);

  // --- Music engine: src+play side-effect runs when station changes ---
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !musicCurrent) return;
    setMusicStatus('loading');
    a.src = musicCurrent.stream;
    a.volume = musicVolume;
    a.play().then(() => { setMusicPlaying(true); setMusicStatus('playing'); })
            .catch(() => { setMusicPlaying(false); setMusicStatus('error'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicCurrent && musicCurrent.id]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = musicVolume; }, [musicVolume]);

  useEffect(() => { localStorage.setItem('iphone-portfolio:theme', themeId); }, [themeId]);
  useEffect(() => { localStorage.setItem('iphone-portfolio:eye', eyeId); }, [eyeId]);
  useEffect(() => {
    if (appOrder) localStorage.setItem('iphone-portfolio:app-order', JSON.stringify(appOrder));
  }, [appOrder]);
  useEffect(() => {
    if (auth) localStorage.setItem('iphone-portfolio:auth', JSON.stringify(auth));
    else localStorage.removeItem('iphone-portfolio:auth');
  }, [auth]);

  const openApp = useCallback((id) => {
    setOpenAppId(curr => {
      setPrevAppId(prevPrev => {
        let nextPrev;
        if (prevPrev === id)         nextPrev = null;
        else if (curr && curr !== id) nextPrev = curr;
        else                         nextPrev = null;
        log('openApp', { id, fromOpenAppId: curr, fromPrevAppId: prevPrev, toPrevAppId: nextPrev });
        return nextPrev;
      });
      return id;
    });
  }, []);
  const closeApp = useCallback(() => {
    setOpenAppId(curr => { log('closeApp', { fromOpenAppId: curr }); return null; });
    setPrevAppId(null);
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') {
        if (authOpen) { setAuthOpen(false); return; }
        if (miniPlayerOpen) { setMiniPlayerOpen(false); return; }
        if (ccOpen) { setCcOpen(false); return; }
        closeApp();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, miniPlayerOpen, ccOpen, closeApp]);

  const setAppOrder = useCallback((next) => setAppOrderState(next), []);
  const resetAppOrder = useCallback(() => {
    localStorage.removeItem('iphone-portfolio:app-order');
    setAppOrderState(null);
  }, []);
  const setAuth = useCallback((u) => setAuthState(u), []);
  const openAuth = useCallback(() => { setCcOpen(false); setMiniPlayerOpen(false); setAuthOpen(true); }, []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);
  const openMiniPlayer  = useCallback(() => { setCcOpen(false); setAuthOpen(false); setMiniPlayerOpen(true); }, []);
  const closeMiniPlayer = useCallback(() => setMiniPlayerOpen(false), []);
  const toggleCc = useCallback(() => setCcOpen(o => {
    const next = !o;
    if (next) { setAuthOpen(false); setMiniPlayerOpen(false); }
    return next;
  }), []);
  const closeCc = useCallback(() => setCcOpen(false), []);

  // --- Music control API ---
  const playStation = useCallback((ch) => {
    if (!ch) return;
    setMusicCurrent(prev => (prev && prev.id === ch.id) ? prev : ch);
  }, []);
  const togglePlay = useCallback(() => {
    const a = audioRef.current; if (!a || !musicCurrent) return;
    if (musicPlaying) { a.pause(); setMusicPlaying(false); setMusicStatus('idle'); }
    else { a.play().then(() => { setMusicPlaying(true); setMusicStatus('playing'); })
                   .catch(() => setMusicStatus('error')); }
  }, [musicCurrent, musicPlaying]);
  const setMusicVolume = useCallback((v) => setMusicVolumeState(v), []);

  const value = useMemo(() => ({
    themeId, setTheme:setThemeId,
    eyeId, setEye:setEyeId,
    homePage, setHomePage,
    openAppId, prevAppId, openApp, closeApp,
    ccOpen, toggleCc, closeCc,
    appOrder, setAppOrder, resetAppOrder,
    auth, setAuth, authOpen, openAuth, closeAuth,
    profileBtnRef, themeBtnRef, musicBtnRef,
    // music
    audioRef,
    musicCurrent, musicPlaying, musicVolume, musicStatus,
    playStation, togglePlay, setMusicVolume,
    miniPlayerOpen, openMiniPlayer, closeMiniPlayer,
    // gesture lock
    dragLocked, lockDrag, unlockDrag,
  }), [themeId, eyeId, homePage, openAppId, prevAppId, ccOpen, appOrder, auth, authOpen,
      musicCurrent, musicPlaying, musicVolume, musicStatus, miniPlayerOpen, dragLocked,
      openApp, closeApp, setAppOrder, resetAppOrder, setAuth, openAuth, closeAuth,
      toggleCc, closeCc, playStation, togglePlay, setMusicVolume, openMiniPlayer, closeMiniPlayer,
      lockDrag, unlockDrag]);
  return <DeviceCtx.Provider value={value}>{children}</DeviceCtx.Provider>;
}

/* ========================= APP DATA ========================= */
const homeApps = [
  { id:'merch',     label:'Merch',     tile:'linear-gradient(135deg,#f43f5e,#7c2d12)', glyph:'🛍️' },
  { id:'blog',      label:'Blog',      tile:'linear-gradient(135deg,#fbbf24,#b45309)', glyph:'✍️' },
  { id:'support',   label:'Support',   tile:'linear-gradient(135deg,#38bdf8,#1e3a8a)', glyph:'🛠️' },
  { id:'music',     label:'Music',     tile:'linear-gradient(135deg,#ec4899,#581c87)', glyph:'🎧' },
  { id:'legal',     label:'Legal',     tile:'linear-gradient(135deg,#94a3b8,#1e293b)', glyph:'⚖️' },
  { id:'settings',  label:'Settings',  tile:'linear-gradient(135deg,#9ca3af,#374151)', glyph:'⚙️' },
  { id:'project-a', label:'Project A', tile:'linear-gradient(135deg,#22d3ee,#0e7490)', glyph:'🚀' },
  { id:'project-b', label:'Project B', tile:'linear-gradient(135deg,#a78bfa,#4c1d95)', glyph:'🧪' },
  { id:'project-c', label:'Project C', tile:'linear-gradient(135deg,#34d399,#065f46)', glyph:'🌿' },
];
const dockApps = [
  { id:'about',     label:'About',     tile:'linear-gradient(135deg,#60a5fa,#1e40af)', glyph:'👤' },
  { id:'services',  label:'Services',  tile:'linear-gradient(135deg,#f59e0b,#b45309)', glyph:'🛠️' },
  { id:'portfolio', label:'Portfolio', tile:'linear-gradient(135deg,#10b981,#065f46)', glyph:'💼' },
  { id:'contact',   label:'Contact',   tile:'linear-gradient(135deg,#ec4899,#831843)', glyph:'✉️' },
];
const allApps = [...homeApps, ...dockApps];
const getApp = id => allApps.find(a => a.id === id);

/* ========================= SHARED APP UI ========================= */
function AppShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-md px-5">
      <h2 className="text-[34px] font-bold leading-tight tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-white/60">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}
const Card = ({ children, className = '' }) => (
  <div className={'rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md ' + className}>{children}</div>
);
const Divider = () => <div className="h-px bg-white/10" />;
const Row = ({ label, value, href }) => {
  const inner = (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px] text-white/60">{label}</span>
      <span className="text-right text-[15px] font-medium text-white">{value}</span>
    </div>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-white/5 rounded-lg px-2">{inner}</a>
    : <div className="px-2">{inner}</div>;
};

/* Slide-in detail view used inside Blog/Legal/Portfolio/Services apps.
   It sits ABOVE the app's list view and provides a Back button that closes only itself. */
function SubView({ open, onBack, title, backLabel, children }) {
  const { closeApp } = useDevice();
  // Lock the underlying AppView section scroll while this is open AND reset its scrollTop
  // so the SubView (which sits inside that scrollable section) always renders flush to the top.
  useEffect(() => {
    if (!open) return;
    const sec = document.querySelector('[data-app-section]');
    if (!sec) return;
    const prevOverflow = sec.style.overflowY;
    const prevScroll = sec.scrollTop;
    sec.scrollTop = 0;
    sec.style.overflowY = 'hidden';
    return () => {
      sec.style.overflowY = prevOverflow;
      sec.scrollTop = prevScroll;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="subview"
          initial={{ x: '100%', opacity: 0.7 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ type: 'spring', stiffness: 320, damping: 36 }}
          className="absolute inset-0 z-30 flex flex-col bg-neutral-950"
        >
          {/* Unified header: Back+label (left) + Title + Close-app X (right) */}
          <div
            className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-950/95 px-4 pb-3 shrink-0 backdrop-blur-md"
            style={{ paddingTop: 'calc(max(env(safe-area-inset-top),12px) + 52px)' }}
          >
            <button onClick={onBack} aria-label={backLabel || 'Back'}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium text-white transition hover:bg-white/25 active:scale-95">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {backLabel && <span className="whitespace-nowrap pr-1">{backLabel}</span>}
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-[14px] font-semibold text-white/90">{title}</span>
            <button onClick={closeApp} aria-label="Close app"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6 L18 18 M18 6 L6 18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="pt-5">{children}</div>
            <div style={{ height: 'calc(max(env(safe-area-inset-bottom),12px) + 40px)' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ========================= APP VIEWS ========================= */
function AboutApp() {
  const { openApp } = useDevice();
  return (
  <AppShell title="About" subtitle="Custom web, mobile, and automation for small businesses and curious creators.">
    <Card>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-700 text-2xl font-bold">RB</div>
        <div>
          <p className="text-[17px] font-semibold">Ryan Baldwin</p>
          <p className="text-[13px] text-white/60">Software Builder · U.S.</p>
        </div>
      </div>
    </Card>
    <Card>
      <Row label="Role" value="Lead Developer" /><Divider />
      <Row label="Preferred Stack" value="React / TS / Postgres / Python" /><Divider />
      <Row label="Years" value="6+" /><Divider />
      <Row label="Location" value="WI, U.S.A." />
    </Card>
    <Card>
      <p className="text-[14px] leading-relaxed text-white/80">
        Hi, I&rsquo;m Ryan. I&rsquo;ve been writing code since I was a teenager,
        but what really keeps me going is the spark of a new idea. Someone
        describes a problem they&rsquo;ve been wrestling with, and suddenly
        I&rsquo;m sketching solutions in a notebook before they&rsquo;ve
        finished talking.
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-white/80">
        I work mostly with small businesses, side projects, and curious
        hobbyists. People who have a clear vision but need a creative partner
        to bring it to life without the agency price tag or the corporate
        runaround. If you can describe what you want over a coffee, I can
        build it.
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-white/80">
        Outside of work I tinker with electronics, brew bad coffee, and
        ask &ldquo;what if we just&hellip;&rdquo; way too often. Send me a
        message and let&rsquo;s see what&rsquo;s possible.
      </p>
    </Card>
    <motion.button
      type="button"
      onClick={() => openApp('contact')}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type:'spring', stiffness:380, damping:26 }}
      className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-4 text-left text-white shadow-[0_12px_32px_-10px_rgba(139,92,246,0.6)] ring-1 ring-white/20">
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
      <span className="relative flex flex-col">
        <span className="text-[16px] font-semibold leading-tight">Contact me</span>
        <span className="text-[12px] text-white/85">Tell me about your idea, project, or curious experiment</span>
      </span>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 ring-1 ring-white/30 transition group-hover:bg-white/30">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </span>
    </motion.button>
  </AppShell>
  );
}

function ContactApp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); };
  return (
    <AppShell title="Contact" subtitle="Let's build something memorable.">
      <Card>
        <Row label="Email" value="hello@creativebuilds.dev" /><Divider />
        <Row label="Phone" value="(608) 344-0203" /><Divider />
        <Row label="Hours" value="Mon – Fri · 6 AM – 8 PM" /><Divider />
        <Row label="Response time" value="< 12 hours" />
      </Card>

      <Card>
        <p className="mb-3 text-[13px] uppercase tracking-wider text-white/50">Send a message</p>
        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            </div>
            <p className="text-[15px] font-semibold">Message received</p>
            <p className="text-[12px] text-white/60">We’ll get back to you within 12 hours.</p>
            <button onClick={() => { setSent(false); setName(''); setEmail(''); setMessage(''); }} className="mt-2 text-[12px] font-medium text-white/70 underline">Send another</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            <textarea required rows="4" value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?"
              className="resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            <button type="submit" className="rounded-2xl bg-white py-3 text-[15px] font-semibold text-black transition active:scale-[0.98]">Send message</button>
          </form>
        )}
      </Card>
    </AppShell>
  );
}

const services = [
  { id:'websites', icon:'🌐', title:'Websites', tag:'Get online',
    body:'Fast, beautiful sites that bring your business or idea to life.',
    detail:'From a simple one-page introduction to a full multi-section business site, I build clean, fast websites that look great on every device and are easy for you to update yourself.',
    bullets:['Landing pages','Multi-page business sites','Mobile-first design','Search engine ready','Easy to update yourself'],
    formField:{ label:'Website type', name:'website_type', options:['Landing page','Business site','Portfolio','Blog','Event / one-off','Other'] } },
  { id:'webapps', icon:'💻', title:'Web Apps', tag:'Tools that work',
    body:'Custom tools you open in any browser. Dashboards, portals, internal tools.',
    detail:'Need a tool to manage how you work? I build custom web apps tailored to your business, accessible from any computer or phone with a browser. No app store, no installs.',
    bullets:['Customer dashboards','Internal team tools','Booking and scheduling','Client portals','Real-time updates'],
    formField:{ label:'App type', name:'app_type', options:['Customer dashboard','Internal tool','Booking system','Client portal','Quoting / invoicing','Other'] } },
  { id:'mobile', icon:'📱', title:'Mobile Apps', tag:'iOS & Android',
    body:'Native mobile apps to put your business in your customers’ pocket.',
    detail:'Whether you need a CRM on the go, an inventory tracker for the field, or a customer-facing app, I build mobile apps that feel native on both iPhone and Android.',
    bullets:['CRM apps','Inventory tracking','Field service tools','Booking and scheduling','Customer-facing apps'],
    formField:{ label:'Application type', name:'application_type', options:['CRM','Inventory Management','Auditing Tools','Booking System','Field Service','E-commerce','Other'] } },
  { id:'automation', icon:'⚙️', title:'Automations', tag:'Save hours',
    body:'Stop doing repetitive work. Get the boring stuff off your plate.',
    detail:'If you find yourself doing the same task week after week, copying data between systems, sending follow-up emails, generating reports, there is almost always a way to automate it. I find it and build it.',
    bullets:['Email follow-ups','Data sync between tools','Report generation','Recurring task scheduling','Spreadsheet wrangling'],
    formField:{ label:'What needs automating?', name:'automation_type', options:['Email follow-ups','Report generation','Data entry','Cross-system sync','Document processing','Other'] } },
  { id:'custom', icon:'🛠️', title:'Custom Software', tag:'Built for you',
    body:'Off the shelf doesn’t fit? Build something made just for your business.',
    detail:'When existing tools force you into their workflow instead of fitting yours, custom software can do exactly what you need and nothing more. I work with you to plan, design, and build software that fits the way you actually work.',
    bullets:['Scoping and planning','Custom workflows','Tailored interfaces','You own the code','Built to grow with you'],
    formField:{ label:'Type of software', name:'software_type', options:['Internal business tool','Customer-facing app','Data processing','Reporting and analytics','Other'] } },
  { id:'ecommerce', icon:'🛒', title:'Online Stores', tag:'Start selling',
    body:'Sell products or services online without thinking about the tech.',
    detail:'I set up online stores that handle payments, inventory, and orders so you can focus on what you sell. Stripe, Shopify, or a fully custom build, whichever fits your needs and budget.',
    bullets:['Product catalogues','Payment processing','Inventory tracking','Order management','Subscription billing'],
    formField:{ label:'What are you selling?', name:'store_type', options:['Physical products','Digital products','Services and bookings','Subscriptions','Mixed','Other'] } },
  { id:'data', icon:'📊', title:'Data & Dashboards', tag:'See clearly',
    body:'Turn spreadsheets into clean, live dashboards that drive decisions.',
    detail:'If your business runs on spreadsheets, I can transform them into live dashboards that update automatically, surface what matters, and help you make better decisions faster.',
    bullets:['Spreadsheet to dashboard','Real-time metrics','Custom reports','Multiple data sources','Visual exports'],
    formField:{ label:'What data are you working with?', name:'data_source', options:['Sales and revenue','Customer data','Inventory','Marketing analytics','Operations','Other'] } },
  { id:'maintenance', icon:'🔧', title:'Maintenance & Support', tag:'Stay running',
    body:'Keep your existing site or app running smoothly. Updates, fixes, improvements.',
    detail:'Already have a website or app that needs ongoing love? I offer monthly maintenance, updates, bug fixes, and small improvements on a flexible plan or per project basis.',
    bullets:['Regular updates','Security patches','Bug fixes','Small feature additions','Performance tune-ups'],
    formField:{ label:'What needs attention?', name:'maintenance_type', options:['Bug fixes','Updates and security','New features','Performance issues','General maintenance','Other'] } },
];
function ServicesApp() {
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);
  const close = () => { setSelected(null); setDone(false); };
  return (
    <>
      <AppShell title="Services" subtitle="From a quick idea to a full system. Tap any service to learn more.">
        {services.map(s => (
          <Card key={s.id}>
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">{s.icon}</div>
              <div className="flex-1">
                <p className="text-[16px] font-semibold">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/70">{s.body}</p>
                <button onClick={() => { setSelected(s); setDone(false); }}
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-white/90 hover:text-white">
                  Learn more
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                </button>
              </div>
            </div>
          </Card>
        ))}
      </AppShell>

      <SubView open={!!selected} onBack={close} title={selected?.title} backLabel="Back to Services">
        {selected && (
          <div className="mx-auto max-w-md px-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-2xl">{selected.icon}</div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50">{selected.tag}</p>
                <h2 className="text-[26px] font-bold leading-tight">{selected.title}</h2>
              </div>
            </div>

            {!done ? (
              <>
                <Card className="mt-5"><p className="text-[14px] leading-relaxed text-white/85">{selected.detail}</p></Card>
                <Card className="mt-3">
                  <p className="mb-2 text-[12px] uppercase tracking-wider text-white/50">What I can build for you</p>
                  <ul className="space-y-2 text-[14px] text-white/85">{selected.bullets.map(b => <li key={b}>• {b}</li>)}</ul>
                </Card>

                {/* Inline contact card. No extra click required */}
                <Card className="mt-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] uppercase tracking-wider text-white/50">Talk to Ryan</p>
                      <p className="mt-0.5 text-[14px] font-semibold">Send a quick note about your project</p>
                    </div>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-base">✉️</div>
                  </div>
                  <ServiceContactForm service={selected} onDone={() => setDone(true)} />
                </Card>
              </>
            ) : (
              <div className="mt-8 flex flex-col items-center gap-3 px-4 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                </div>
                <p className="text-[18px] font-semibold">Message sent</p>
                <p className="text-[13px] text-white/65">Thanks for reaching out about <span className="text-white">{selected.title}</span>. Ryan will follow up within 12 hours.</p>
                <button onClick={close} className="mt-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/20">Back to services</button>
              </div>
            )}
          </div>
        )}
      </SubView>
    </>
  );
}

function ServiceContactForm({ service, onDone }) {
  const defaultMsg = (v) => `Hi Ryan, I am looking for more information about ${article(v)} ${v}. Do you have a few moments to chat?`;
  function article(word) {
    if (!word) return 'a';
    return /^[aeiouAEIOU]/.test(word.trim()) ? 'an' : 'a';
  }
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldValue, setFieldValue] = useState(service.formField.options[0]);
  const [message, setMessage] = useState(() => defaultMsg(service.formField.options[0]));
  const [touchedMsg, setTouchedMsg] = useState(false);
  useEffect(() => { if (!touchedMsg) setMessage(defaultMsg(fieldValue)); }, [fieldValue, touchedMsg]);

  return (
    <form onSubmit={e => { e.preventDefault(); onDone(); }} className="flex flex-col gap-3">
      <p className="text-[12px] text-white/60">Most fields are optional. An email and a service type is enough to get started.</p>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Email <span className="text-rose-300">*</span></span>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Name <span className="text-white/35">optional</span></span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Phone <span className="text-white/35">optional</span></span>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(   )   -    "
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">{service.formField.label}</span>
        <select value={fieldValue} onChange={e => setFieldValue(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30">
          {service.formField.options.map(o => <option key={o}>{o}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Message</span>
        <textarea rows="4" value={message} onChange={e => { setTouchedMsg(true); setMessage(e.target.value); }}
          className="resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
        {!touchedMsg && (
          <span className="text-[10px] italic text-white/40">Auto-filled based on your selection. Tap to customise.</span>
        )}
      </label>

      <div className="mt-1 flex">
        <button type="submit" className="flex-1 rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">Send message</button>
      </div>
    </form>
  );
}

const work = [
  { id:'project-a', name:'Project A: Orbital Bank', tag:'Fintech · 2024', color:'from-indigo-500 to-fuchsia-600',
    summary:'A bold marketing experience that pairs an interactive 3D hero with a scroll-driven product reveal.',
    role:'Lead Frontend', year:'2024', stack:'Next · R3F · GSAP',
    highlights:['96 Lighthouse · 1.1s LCP','Custom GLSL refractive material','38% lift in conversion vs. previous site'] },
  { id:'project-b', name:'Project B: Nimbus CMS', tag:'SaaS · 2023', color:'from-emerald-400 to-cyan-700',
    summary:'A multi-tenant headless CMS with a drag-and-drop block editor and edge-rendered preview.',
    role:'Tech Lead', year:'2023', stack:'Next · tRPC · Postgres',
    highlights:['12K+ active workspaces','Block editor with 40+ types','Sub-200ms preview on the edge'] },
  { id:'project-c', name:'Project C: Atlas Travel', tag:'WebGL · 2023', color:'from-amber-400 to-rose-600',
    summary:'An immersive travel storytelling platform with a 3D world map and cinematic destination guides.',
    role:'Creative Engineer', year:'2023', stack:'three.js · GSAP · Lenis',
    highlights:['Custom globe shader','220K monthly active users','Featured in Awwwards SOTD'] },
  { id:'project-d', name:'Helix Studio', tag:'Agency · 2022', color:'from-violet-500 to-purple-900',
    summary:'A boutique creative agency site with kinetic typography and a magnetic cursor.',
    role:'Frontend Lead', year:'2022', stack:'Vite · GSAP · Three.js',
    highlights:['Awwwards Honourable Mention','100/100 Lighthouse','Bespoke shader gallery'] },
];
function PortfolioApp() {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <AppShell title="Portfolio" subtitle="Tap a project to dive in.">
        <div className="grid grid-cols-2 gap-3">
          {work.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className="text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.06] backdrop-blur-md transition hover:border-white/25 active:scale-[0.98]">
              <div className={'aspect-[4/3] bg-gradient-to-br ' + p.color} />
              <div className="p-3">
                <p className="text-[14px] font-semibold">{p.name}</p>
                <p className="text-[11px] text-white/60">{p.tag}</p>
              </div>
            </button>
          ))}
        </div>
      </AppShell>

      <SubView open={!!selected} onBack={() => setSelected(null)} title={selected?.name} backLabel="Back to Portfolio">
        {selected && (
          <div className="mx-auto max-w-md px-5">
            <Card className="!p-0 overflow-hidden">
              <div className={'aspect-[16/10] bg-gradient-to-br ' + selected.color} />
            </Card>
            <h2 className="mt-5 text-[28px] font-bold leading-tight">{selected.name}</h2>
            <p className="mt-1 text-[13px] text-white/60">{selected.tag}</p>
            <Card className="mt-4">
              <Row label="Role" value={selected.role} /><Divider />
              <Row label="Year" value={selected.year} /><Divider />
              <Row label="Stack" value={selected.stack} />
            </Card>
            <Card className="mt-3">
              <p className="text-[13px] uppercase tracking-wider text-white/50">Summary</p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/85">{selected.summary}</p>
            </Card>
            <Card className="mt-3">
              <p className="text-[13px] uppercase tracking-wider text-white/50">Highlights</p>
              <ul className="mt-2 space-y-2 text-[14px] text-white/85">
                {selected.highlights.map(h => <li key={h}>• {h}</li>)}
              </ul>
            </Card>
          </div>
        )}
      </SubView>
    </>
  );
}

const merchCategories = [
  { id:'all',      label:'All',       icon:'✨' },
  { id:'apparel',  label:'Apparel',   icon:'👕' },
  { id:'drink',    label:'Drinkware', icon:'☕' },
  { id:'sticker',  label:'Stickers',  icon:'🌟' },
  { id:'tech',     label:'Tech',      icon:'⌨️' },
];
const merch = [
  { id:'m1', name:'Hoodie · “Ship It”', cat:'apparel', price:48, color:'from-rose-500 to-red-800',
    description:'Heavyweight 380gsm fleece, brushed interior, embroidered chest mark. Built for late-night release pushes and weekend deploys.',
    variants:{ Size:['XS','S','M','L','XL','XXL'], Color:['Crimson','Ink','Stone'] },
    images:['from-rose-500 to-red-800','from-rose-400 to-pink-700','from-red-700 to-rose-900'] },
  { id:'m2', name:'Tee · “console.log”', cat:'apparel', price:22, color:'from-sky-400 to-blue-800',
    description:'180gsm combed cotton with a soft hand-feel. Screen-printed in the UK with water-based inks.',
    variants:{ Size:['XS','S','M','L','XL'], Color:['Sky','Black','Cream'] },
    images:['from-sky-400 to-blue-800','from-cyan-400 to-blue-700','from-sky-500 to-indigo-800'] },
  { id:'m3', name:'Mug · “404”', cat:'drink', price:14, color:'from-amber-400 to-orange-700',
    description:'350ml ceramic mug. Dishwasher-safe wraparound print. Microwave-safe up to two reheats of cold coffee.',
    variants:{ Style:['Matte','Gloss'] },
    images:['from-amber-400 to-orange-700','from-yellow-400 to-amber-600','from-orange-500 to-red-700'] },
  { id:'m4', name:'Sticker pack', cat:'sticker', price:6, color:'from-emerald-400 to-teal-800',
    description:'Ten weather-proof vinyl stickers. Perfect for laptops, water bottles, or any flat surface that needs more personality.',
    variants:{},
    images:['from-emerald-400 to-teal-800','from-green-400 to-emerald-700','from-teal-400 to-cyan-700'] },
  { id:'m5', name:'Cap · Embroidered', cat:'apparel', price:28, color:'from-indigo-500 to-violet-900',
    description:'Six-panel structured cap with low-profile embroidered logo and adjustable buckle strap.',
    variants:{ Color:['Ink','Stone','Olive'] },
    images:['from-indigo-500 to-violet-900','from-blue-500 to-indigo-800','from-violet-500 to-purple-900'] },
  { id:'m6', name:'Keycap set', cat:'tech', price:42, color:'from-fuchsia-500 to-purple-800',
    description:'PBT double-shot keycaps in the CreativeBuilds colorway. Cherry profile, 141 keys, compatible with most mechanical keyboards.',
    variants:{ Profile:['Cherry','OEM'] },
    images:['from-fuchsia-500 to-purple-800','from-pink-500 to-fuchsia-700','from-purple-500 to-fuchsia-800'] },
  { id:'m7', name:'Bottle · Insulated', cat:'drink', price:24, color:'from-cyan-400 to-blue-700',
    description:'500ml double-walled stainless steel. Keeps cold drinks cold for 24 hours, hot drinks hot for 12.',
    variants:{ Color:['Steel','Black','White'] },
    images:['from-cyan-400 to-blue-700','from-sky-400 to-cyan-700','from-blue-400 to-sky-700'] },
  { id:'m8', name:'Holographic stickers', cat:'sticker', price:9, color:'from-pink-400 to-purple-700',
    description:'Five iridescent vinyl stickers that catch the light differently from every angle.',
    variants:{},
    images:['from-pink-400 to-purple-700','from-fuchsia-400 to-pink-700','from-rose-400 to-fuchsia-700'] },
];
function MerchApp() {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);  // product detail
  const [cart, setCart] = useState([]);            // [{ id, name, price, variant, qty }]
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStage, setCheckoutStage] = useState(null); // null | 'address' | 'payment' | 'done'

  const filtered = merch.filter(p =>
    (cat === 'all' || p.cat === cat) &&
    (q.trim() === '' || p.name.toLowerCase().includes(q.toLowerCase()))
  );
  const cartCount = cart.reduce((a,b) => a + b.qty, 0);
  const cartTotal = cart.reduce((a,b) => a + b.price * b.qty, 0);

  const addToCart = (product, variantPicks) => {
    const variantLabel = Object.entries(variantPicks).map(([k,v]) => `${k}: ${v}`).join(' · ');
    setCart(prev => {
      const key = product.id + '|' + variantLabel;
      const existing = prev.find(c => c.key === key);
      if (existing) return prev.map(c => c.key === key ? { ...c, qty:c.qty + 1 } : c);
      return [...prev, { key, id:product.id, name:product.name, price:product.price, variant:variantLabel, qty:1, color:product.color }];
    });
    setCartOpen(true);
  };
  const removeFromCart = (key) => setCart(prev => prev.filter(c => c.key !== key));
  const setQty = (key, delta) => setCart(prev => prev.map(c => c.key === key ? { ...c, qty:c.qty + delta } : c).filter(c => c.qty > 0));

  return (
    <>
      {/* Merch-only cart icon, floating top-right under the close button */}
      <button onClick={() => setCartOpen(true)} aria-label="Open cart"
        className="fixed right-16 z-[55] grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 active:scale-95"
        style={{ top:'calc(max(env(safe-area-inset-top),12px) + 52px)' }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
        </svg>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 px-1 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">{cartCount}</span>
        )}
      </button>

      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4">
          <h2 className="text-[34px] font-bold leading-tight tracking-tight">Merch</h2>
          <p className="mt-1 text-[15px] text-white/60">Soft cotton. Strong opinions.</p>
        </div>

        <div className="flex gap-4">
          {/* CATEGORY SIDEBAR + SEARCH */}
          <aside className="w-[140px] shrink-0">
            <div className="sticky top-0 flex flex-col gap-3">
              <div className="relative">
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-2 py-2 text-[13px] outline-none focus:border-white/30" />
              </div>
              <p className="px-2 pt-1 text-[10px] uppercase tracking-wider text-white/45">Categories</p>
              <nav className="flex flex-col gap-1">
                {merchCategories.map(c => (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className={'flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition ' +
                      (cat === c.id ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* PRODUCT GRID */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.04] py-16 text-center text-[14px] text-white/60">
                No products match “{q}”.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(m => {
                  const variantGroups = Object.values(m.variants);
                  const hasChoice = variantGroups.some(opts => opts.length > 1);
                  const quickBuy = (e) => {
                    e.stopPropagation();
                    if (hasChoice) { setSelected(m); return; }
                    const picks = {};
                    Object.entries(m.variants).forEach(([k,v]) => { picks[k] = v[0]; });
                    addToCart(m, picks);
                  };
                  return (
                    <button key={m.id} onClick={() => setSelected(m)}
                      className="text-left overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md transition hover:border-white/25 active:scale-[0.98]">
                      <div className={'aspect-square bg-gradient-to-br ' + m.color} />
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold leading-tight">{m.name}</p>
                          <p className="mt-0.5 text-[12px] text-white/60">£{m.price}</p>
                        </div>
                        <button onClick={quickBuy}
                          title={hasChoice ? 'Select options' : 'Add to cart'}
                          className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black transition hover:bg-white/90 active:scale-95">
                          {hasChoice ? 'Options' : 'Buy'}
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCT DETAIL */}
      <SubView open={!!selected} onBack={() => setSelected(null)} title={selected?.name} backLabel="Back to Merch">
        {selected && <ProductDetail product={selected} onAdd={(picks) => addToCart(selected, picks)} />}
      </SubView>

      {/* CART SIDE PANEL */}
      <CartPanel open={cartOpen} onClose={() => { setCartOpen(false); setCheckoutStage(null); }}
        cart={cart} cartTotal={cartTotal} removeFromCart={removeFromCart} setQty={setQty}
        checkoutStage={checkoutStage} setCheckoutStage={setCheckoutStage}
        clearCart={() => { setCart([]); setCheckoutStage(null); }} />
    </>
  );
}

function ProductDetail({ product, onAdd }) {
  const [picks, setPicks] = useState(() => {
    const out = {};
    Object.entries(product.variants).forEach(([k,v]) => { out[k] = v[0]; });
    return out;
  });
  const [activeImg, setActiveImg] = useState(0);
  return (
    <div className="mx-auto max-w-2xl px-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="sm:w-1/2">
          <div className={'aspect-square overflow-hidden rounded-3xl bg-gradient-to-br ' + product.images[activeImg]} />
          <div className="mt-3 flex gap-2">
            {product.images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)}
                className={'aspect-square w-16 rounded-xl bg-gradient-to-br ' + img + ' ' + (i === activeImg ? 'ring-2 ring-white' : 'ring-1 ring-white/15')} />
            ))}
          </div>
        </div>
        <div className="sm:w-1/2 sm:pl-2">
          <h2 className="text-[26px] font-bold leading-tight">{product.name}</h2>
          <p className="mt-1 text-[20px] font-semibold text-white/90">£{product.price}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-white/75">{product.description}</p>

          <div className="mt-5 flex flex-col gap-4">
            {Object.entries(product.variants).map(([key, options]) => (
              <div key={key}>
                <p className="mb-2 text-[12px] uppercase tracking-wider text-white/55">{key}</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(opt => (
                    <button key={opt} onClick={() => setPicks(p => ({ ...p, [key]:opt }))}
                      className={'rounded-full px-3 py-1.5 text-[12px] font-medium transition ' +
                        (picks[key] === opt ? 'bg-white text-black' : 'bg-white/10 text-white/80 hover:bg-white/20')}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => onAdd(picks)}
            className="mt-6 block w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition active:scale-[0.98]">
            Add to cart · £{product.price}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartPanel({ open, onClose, cart, cartTotal, removeFromCart, setQty, checkoutStage, setCheckoutStage, clearCart }) {
  return (
    <AnimatePresence>
      {open && (
        <React.Fragment>
          <motion.div key="cart-scrim" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
          <motion.aside key="cart-panel"
            initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
            transition={{ type:'spring', stiffness:320, damping:38 }}
            className="fixed right-0 bottom-0 z-[70] flex w-full max-w-[420px] flex-col bg-neutral-950/95 backdrop-blur-xl border-l border-white/10"
            style={{ top:'calc(max(env(safe-area-inset-top),12px) + 44px)' }}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-[18px] font-semibold">{checkoutStage ? 'Checkout' : 'Your cart'}</h2>
              <button onClick={onClose} aria-label="Close cart"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white/60">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
                  </div>
                  <p className="text-[15px] font-medium">Your cart is empty</p>
                  <p className="text-[12px] text-white/55">Browse merch and tap Add to cart.</p>
                </div>
              ) : checkoutStage === 'done' ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                  </div>
                  <p className="text-[18px] font-semibold">Order placed</p>
                  <p className="text-[13px] text-white/65">A confirmation has been sent to your email.</p>
                  <button onClick={() => { clearCart(); onClose(); }} className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium hover:bg-white/20">Keep shopping</button>
                </div>
              ) : checkoutStage === 'address' ? (
                <CheckoutAddress onBack={() => setCheckoutStage(null)} onNext={() => setCheckoutStage('payment')} />
              ) : checkoutStage === 'payment' ? (
                <CheckoutPayment total={cartTotal} onBack={() => setCheckoutStage('address')} onPay={() => setCheckoutStage('done')} />
              ) : (
                <ul className="flex flex-col gap-3">
                  {cart.map(item => (
                    <li key={item.key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
                      <div className={'h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br ' + item.color} />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold leading-tight">{item.name}</p>
                        {item.variant && <p className="mt-0.5 text-[11px] text-white/55">{item.variant}</p>}
                        <div className="mt-1.5 flex items-center gap-2">
                          <button onClick={() => setQty(item.key, -1)} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">−</button>
                          <span className="text-[12px] tabular-nums">{item.qty}</span>
                          <button onClick={() => setQty(item.key, +1)} className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-semibold">£{item.price * item.qty}</p>
                        <button onClick={() => removeFromCart(item.key)} className="mt-1 text-[11px] text-white/50 hover:text-white">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.length > 0 && !checkoutStage && (
              <div className="border-t border-white/10 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] text-white/65">Subtotal</span>
                  <span className="text-[16px] font-semibold tabular-nums">£{cartTotal}</span>
                </div>
                <button onClick={() => setCheckoutStage('address')} className="w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">Checkout</button>
              </div>
            )}
          </motion.aside>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

function CheckoutAddress({ onBack, onNext }) {
  const [f, setF] = useState({ name:'', addr:'', city:'', zip:'' });
  const set = (k,v) => setF(s => ({ ...s, [k]:v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onNext(); }} className="flex flex-col gap-3">
      <p className="text-[12px] uppercase tracking-wider text-white/55">Shipping address</p>
      <input required value={f.name} onChange={e => set('name', e.target.value)} placeholder="Full name" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      <input required value={f.addr} onChange={e => set('addr', e.target.value)} placeholder="Address" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      <div className="grid grid-cols-2 gap-2">
        <input required value={f.city} onChange={e => set('city', e.target.value)} placeholder="City" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
        <input required value={f.zip} onChange={e => set('zip', e.target.value)} placeholder="Postcode" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-2xl border border-white/15 py-2.5 text-[14px] font-semibold text-white/80">Back</button>
        <button type="submit" className="flex-[2] rounded-2xl bg-white py-2.5 text-[14px] font-semibold text-black active:scale-[0.98]">Continue</button>
      </div>
    </form>
  );
}
function CheckoutPayment({ total, onBack, onPay }) {
  const [f, setF] = useState({ card:'', exp:'', cvc:'' });
  const set = (k,v) => setF(s => ({ ...s, [k]:v }));
  return (
    <form onSubmit={e => { e.preventDefault(); onPay(); }} className="flex flex-col gap-3">
      <p className="text-[12px] uppercase tracking-wider text-white/55">Payment</p>
      <input required value={f.card} onChange={e => set('card', e.target.value)} placeholder="Card number" inputMode="numeric" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      <div className="grid grid-cols-2 gap-2">
        <input required value={f.exp} onChange={e => set('exp', e.target.value)} placeholder="MM / YY" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
        <input required value={f.cvc} onChange={e => set('cvc', e.target.value)} placeholder="CVC" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px]">
        <span className="text-white/65">Total due</span>
        <span className="text-[16px] font-semibold tabular-nums">£{total}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded-2xl border border-white/15 py-2.5 text-[14px] font-semibold text-white/80">Back</button>
        <button type="submit" className="flex-[2] rounded-2xl bg-white py-2.5 text-[14px] font-semibold text-black active:scale-[0.98]">Pay £{total}</button>
      </div>
    </form>
  );
}



const legalDocs = [
  { id:'privacy', title:'Privacy Policy', summary:'How we (don’t) collect data.',
    sections:[
      { h:'Data we collect', p:'None. This site uses no analytics scripts, no advertising pixels, and no third-party trackers. The single piece of information stored locally is your selected theme preference, kept in your browser’s localStorage.' },
      { h:'Cookies', p:'No cookies. The localStorage key is removed if you clear site data from your browser settings.' },
      { h:'Communication', p:'If you submit the Contact form, your name, email, and message are sent securely to our support inbox. We use that information solely to reply.' },
      { h:'Your rights', p:'You can request deletion of any data you’ve sent us by emailing hello@creativebuilds.dev. We respond to all such requests within 30 days.' },
    ] },
  { id:'terms', title:'Terms of Use', summary:'The boring fine print.',
    sections:[
      { h:'Acceptance', p:'By using this site you accept these terms in full. If you disagree with any part, please do not use the site.' },
      { h:'Intellectual property', p:'All content, design, and code are the property of CreativeBuilds unless otherwise noted. Third-party brand assets remain the property of their respective owners.' },
      { h:'Limitation of liability', p:'Content is provided “as is” without warranty of any kind. We are not liable for any indirect or consequential loss arising from use of this site.' },
      { h:'Changes', p:'We may update these terms at any time. The latest version always lives at this URL.' },
    ] },
  { id:'cookies', title:'Cookies', summary:'Genuinely none.',
    sections:[
      { h:'What we use', p:'We do not set cookies. We do use a single localStorage entry to remember your theme.' },
      { h:'How to clear', p:'Open your browser’s site settings for this domain and click “Clear site data”. That removes the theme preference.' },
    ] },
];

function LegalApp() {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <AppShell title="Legal" subtitle="Tap a document to read in full.">
        {legalDocs.map(d => (
          <button key={d.id} onClick={() => setSelected(d)} className="text-left">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold">{d.title}</p>
                  <p className="mt-1 text-[13px] text-white/65">{d.summary}</p>
                </div>
                <span className="mt-1 text-white/40">›</span>
              </div>
            </Card>
          </button>
        ))}
        <p className="px-2 text-center text-[11px] text-white/40">© {new Date().getFullYear()} CreativeBuilds · <a href="https://creativebuilds.dev" className="hover:text-white/70">creativebuilds.dev</a> · All rights reserved.</p>
      </AppShell>

      <SubView open={!!selected} onBack={() => setSelected(null)} title="Legal" backLabel="Back to Legal">
        {selected && (
          <div className="mx-auto max-w-md px-5">
            <h1 className="text-[28px] font-bold leading-tight">{selected.title}</h1>
            <p className="mt-1 text-[13px] text-white/60">Last updated · {new Date().toLocaleDateString()}</p>
            <div className="mt-5 flex flex-col gap-4">
              {selected.sections.map(s => (
                <Card key={s.h}>
                  <p className="text-[15px] font-semibold">{s.h}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/75">{s.p}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </SubView>
    </>
  );
}

const posts = [
  { id:'p1', title:'Shipping a Lighthouse-100 React app in 2025', date:'Nov 04', read:'8 min',
    excerpt:'A field guide to the boring wins that compound: bundle splitting, image strategy, and the unsexy CDN settings that move the needle.',
    body:[
      'Performance work isn’t a single hero pull-request. It’s a hundred small decisions made consistently across a codebase, and the discipline to revisit them every release.',
      'In this post we walk through the audit we run on every project: opening DevTools, recording a 6× CPU throttled trace, identifying the long tasks, and breaking them apart with route-level code splitting.',
      'We’ll also cover the often-overlooked CDN settings (stale-while-revalidate, immutable assets, brotli compression) that make repeat visits feel instant.',
      'Finally: how to wire all of this into CI so regressions never reach production.'
    ] },
  { id:'p2', title:'GLSL for designers: a gentle on-ramp', date:'Oct 18', read:'12 min',
    excerpt:'You don’t need a CS degree to write your first fragment shader. Start with color, then noise, then displacement.',
    body:[
      'Shaders are intimidating because the syntax is unfamiliar and the feedback loop feels alien. There is no console.log, just pixels.',
      'But fragment shaders are really just a function: for every pixel on screen, return a color. Once you internalize that, the rest is just math.',
      'We start with constants, move to UVs, then introduce time. By the end of part one you’ll have a gradient that pulses.'
    ] },
  { id:'p3', title:'Choreographing scroll with GSAP & Lenis', date:'Sep 27', read:'6 min',
    excerpt:'Smooth scroll gets a bad rap. Done well, it’s the difference between a website and an experience.',
    body:[
      'Smooth scroll has earned its reputation. Most implementations fight the browser, break find-on-page, and add jank on low-end devices.',
      'Lenis sidesteps most of these issues by piggy-backing on the native scroll position. Combined with GSAP ScrollTrigger, you get buttery transitions without fighting the platform.'
    ] },
  { id:'p4', title:'Design tokens that actually scale', date:'Aug 12', read:'9 min',
    excerpt:'Most token systems collapse under their own weight. Here’s how to design one that survives three product redesigns.',
    body:[
      'The first token system you build is almost always too granular. The second is too coarse. The third one, finally, fits.',
      'In this post we share the three-tier token taxonomy we’ve standardised on: primitives, semantic, and component.'
    ] },
];
function BlogApp() {
  const [selected, setSelected] = useState(null);
  const [subEmail, setSubEmail] = useState('');
  const [subbed, setSubbed] = useState(false);
  const subscribe = (e) => { e.preventDefault(); setSubbed(true); };
  return (
    <>
      <AppShell title="Blog" subtitle="Notes from the workshop.">
        {/* Pinned newsletter card */}
        <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-amber-400/15 via-fuchsia-500/10 to-indigo-500/15 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-lg">✉️</div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold">Subscribe to the newsletter</p>
              <p className="mt-0.5 text-[12px] text-white/65">Free designs, tutorials, news & more. No spam, just info that matters.</p>
            </div>
          </div>
          {subbed ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-[13px] text-emerald-200">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              Subscribed. See you in your inbox.
            </div>
          ) : (
            <form onSubmit={subscribe} className="mt-3 flex gap-2">
              <input required type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)} placeholder="you@email.com"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] outline-none focus:border-white/30" />
              <button type="submit" className="rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-black active:scale-95">Subscribe</button>
            </form>
          )}
        </div>

        {/* Visual separator */}
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-wider text-white/40">Latest posts</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {posts.map(p => (
          <button key={p.id} onClick={() => setSelected(p)} className="text-left">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[15px] font-semibold leading-snug">{p.title}</p>
                  <p className="mt-1 text-[12px] text-white/55">{p.date} · {p.read}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/70">{p.excerpt}</p>
                </div>
                <span className="mt-1 text-white/40">›</span>
              </div>
            </Card>
          </button>
        ))}
      </AppShell>

      <SubView open={!!selected} onBack={() => setSelected(null)} title="Blog" backLabel="Back to Blog">
        {selected && (
          <article className="mx-auto max-w-md px-5">
            <p className="text-[11px] uppercase tracking-wider text-white/50">{selected.date} · {selected.read}</p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight">{selected.title}</h1>
            <p className="mt-3 text-[15px] italic leading-relaxed text-white/70">{selected.excerpt}</p>
            <div className="mt-6 flex flex-col gap-4 text-[15px] leading-relaxed text-white/85">
              {selected.body.map((para, i) => <p key={i}>{para}</p>)}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[13px] text-white/70">
              Enjoyed this? Follow along or get in touch via the Contact app.
            </div>
          </article>
        )}
      </SubView>
    </>
  );
}

const SettingsApp = () => {
  const { themeId, setTheme, eyeId, setEye } = useDevice();
  return (
    <AppShell title="Settings" subtitle="Personalise the device.">
      <Card>
        <p className="mb-3 text-[13px] uppercase tracking-wider text-white/50">Wallpaper & Glass</p>
        <div className="grid grid-cols-2 gap-3">
          {themeOrder.map(id => {
            const t = themes[id], active = id === themeId;
            return (
              <button key={id} onClick={() => setTheme(id)}
                className={'flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-2 text-left transition ' +
                  (active ? 'ring-2 ring-white' : 'ring-1 ring-white/10 hover:ring-white/30')}>
                <div className="h-20 w-full rounded-xl" style={{ background:t.wallpaper }} />
                <span className="px-1 text-[12px] font-medium">{t.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="mb-3 text-[13px] uppercase tracking-wider text-white/50">Carrier eye icon</p>
        <div className="grid grid-cols-3 gap-2">
          {eyeOrder.map(id => {
            const e = eyes[id], active = id === eyeId;
            return (
              <button key={id} onClick={() => setEye(id)}
                className={'flex flex-col items-center gap-1.5 rounded-2xl p-3 transition ' +
                  (active ? 'bg-white/15 ring-2 ring-white' : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10')}>
                <span className="inline-block h-6 w-6 text-white">{e.svg}</span>
                <span className="text-[11px] font-medium">{e.name}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-[13px] uppercase tracking-wider text-white/50">About this device</p>
        <p className="text-[14px] text-white/80">
          Built with React, Tailwind, and Framer Motion. The whole browser window <em>is</em> the iPhone.
          Try opening an app, dragging it down to close, or pressing <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]">Esc</kbd>.
        </p>
      </Card>
    </AppShell>
  );
};

/* ===================== SUPPORT APP ===================== */
const supportCategories = ['Bug / Issue','Feature Request','Billing','Account / Login','Technical Question','Other'];
const supportPriorities = ['Low','Normal','High','Urgent'];

function SupportApp() {
  const [mode, setMode] = useState('home'); // home | login | guest | submitted
  const [loggedIn, setLoggedIn] = useState(false);
  const [clientName, setClientName] = useState('');

  // Reset everything when navigating home
  const goHome = () => { setMode('home'); };

  return (
    <>
      <AppShell title="Support" subtitle="Open a ticket and we’ll respond fast. Existing clients get the express lane.">
        {mode === 'home' && (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/20 text-xl">🔑</div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">Existing client</p>
                  <p className="mt-0.5 text-[12px] text-white/65">Log in to skip the questions and route straight to your account team.</p>
                </div>
              </div>
              <button onClick={() => setMode('login')}
                className="mt-4 w-full rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">
                Log in for expedited support
              </button>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/20 text-xl">✍️</div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">Submit a ticket</p>
                  <p className="mt-0.5 text-[12px] text-white/65">No account needed. Provide a Client ID if you have one and we’ll route accordingly.</p>
                </div>
              </div>
              <button onClick={() => setMode('guest')}
                className="mt-4 w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-[14px] font-semibold text-white active:scale-[0.98] hover:bg-white/10">
                Open ticket form
              </button>
            </Card>
            <Card>
              <p className="text-[12px] uppercase tracking-wider text-white/50">Response times</p>
              <div className="mt-2 space-y-1.5 text-white/85">
                <p>• <span className="font-medium">Urgent</span>: within 2 business hours</p>
                <p>• <span className="font-medium">High</span>: same business day</p>
                <p>• <span className="font-medium">Normal</span>: within 24 hours</p>
                <p>• <span className="font-medium">Low</span>: within 3 business days</p>
              </div>
            </Card>
          </>
        )}

        {mode === 'login' && !loggedIn && (
          <SupportLogin onBack={goHome} onSuccess={(name) => { setClientName(name); setLoggedIn(true); }} />
        )}
        {mode === 'login' && loggedIn && (
          <SupportTicketForm authedName={clientName} onBack={goHome} onSubmitted={() => setMode('submitted')} />
        )}
        {mode === 'guest' && (
          <SupportTicketForm onBack={goHome} onSubmitted={() => setMode('submitted')} />
        )}
        {mode === 'submitted' && (
          <SupportSubmitted onDone={() => { setLoggedIn(false); setClientName(''); goHome(); }} />
        )}
      </AppShell>
    </>
  );
}

function SupportLogin({ onBack, onSuccess }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); const n = email.split('@')[0] || 'Client'; onSuccess(n.charAt(0).toUpperCase()+n.slice(1)); }}>
      <Card>
        <p className="text-[12px] uppercase tracking-wider text-white/50">Client log in</p>
        <p className="mt-1 text-[13px] text-white/65">Demo only. Any credentials will log you in.</p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Email</span>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Password</span>
            <input required type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onBack} className="flex-1 rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-white/80">Cancel</button>
            <button type="submit" className="flex-[2] rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">Log in</button>
          </div>
          <button type="button" className="mt-1 text-[12px] text-white/55 hover:text-white">Forgot password?</button>
        </div>
      </Card>
    </form>
  );
}

function SupportTicketForm({ authedName, onBack, onSubmitted }) {
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(supportCategories[0]);
  const [priority, setPriority] = useState('Normal');
  const [pref, setPref] = useState('Email'); // Email | Phone | Text
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [description, setDescription] = useState('');

  // Conditional contact field based on preference
  const needsEmail = pref === 'Email';
  const needsPhone = pref === 'Phone' || pref === 'Text';

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmitted(); }}>
      {authedName && (
        <Card>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/25 text-base">✓</div>
            <div>
              <p className="text-[14px] font-semibold">Welcome back, {authedName}</p>
              <p className="text-[11px] text-white/55">Your ticket will be routed to your account team automatically.</p>
            </div>
          </div>
        </Card>
      )}
      <Card>
        <p className="text-[12px] uppercase tracking-wider text-white/50">New ticket</p>
        <div className="mt-3 flex flex-col gap-3">
          {!authedName && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Client ID <span className="text-white/35">optional</span></span>
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="e.g. CB-04821"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Ticket title</span>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Short summary of the issue"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Category</span>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30">
                {supportCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Priority</span>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30">
                {supportPriorities.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Follow up preference</span>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white/5 p-1">
              {['Email','Phone','Text'].map(p => (
                <button key={p} type="button" onClick={() => setPref(p)}
                  className={'rounded-lg py-2 text-[12px] font-medium transition ' +
                    (pref === p ? 'bg-white text-black' : 'text-white/75 hover:text-white')}>
                  {p === 'Email' ? '✉️' : p === 'Phone' ? '📞' : '💬'} {p}
                </button>
              ))}
            </div>
          </div>

          {needsEmail && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Reply email</span>
              <input required type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="you@email.com"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            </label>
          )}
          {needsPhone && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">{pref === 'Text' ? 'Text-capable number' : 'Phone number'}</span>
              <input required type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="(555) 123-4567"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/55">Describe the issue</span>
            <textarea required rows="5" value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened, what you expected, and any steps to reproduce…"
              className="resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[14px] outline-none focus:border-white/30" />
          </label>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onBack} className="flex-1 rounded-2xl border border-white/15 py-3 text-[14px] font-semibold text-white/80">Cancel</button>
            <button type="submit" className="flex-[2] rounded-2xl bg-white py-3 text-[14px] font-semibold text-black active:scale-[0.98]">Submit ticket</button>
          </div>
        </div>
      </Card>
    </form>
  );
}

function SupportSubmitted({ onDone }) {
  const ticketId = useMemo(() => 'CB-' + Math.floor(10000 + Math.random() * 89999), []);
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-4 py-2 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
        </div>
        <p className="text-[18px] font-semibold">Ticket submitted</p>
        <p className="text-[12px] text-white/60">Reference</p>
        <p className="-mt-1 rounded-lg bg-white/10 px-3 py-1 font-mono text-[14px] text-white">{ticketId}</p>
        <p className="max-w-xs text-[13px] text-white/65">A confirmation has been sent. We’ll be in touch via your chosen method.</p>
        <button onClick={onDone} className="mt-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/20">Back to support</button>
      </div>
    </Card>
  );
}

/* ===================== MUSIC APP: NIGHTRIDE.FM ===================== */
const musicChannels = [
  { id:'nightride',   name:'Nightride',    tag:'Synthwave',       color:'from-fuchsia-500 to-purple-900',  stream:'https://stream.nightride.fm/nightride.m4a' },
  { id:'chillsynth',  name:'Chillsynth',   tag:'Chillwave',       color:'from-cyan-400 to-blue-800',       stream:'https://stream.nightride.fm/chillsynth.m4a' },
  { id:'datawave',    name:'Datawave',     tag:'Cyber / Glitch',  color:'from-emerald-400 to-teal-900',    stream:'https://stream.nightride.fm/datawave.m4a' },
  { id:'spacesynth',  name:'Spacesynth',   tag:'Space Disco',     color:'from-violet-400 to-indigo-900',   stream:'https://stream.nightride.fm/spacesynth.m4a' },
  { id:'darksynth',   name:'Darksynth',    tag:'Dark Synth',      color:'from-rose-500 to-red-900',        stream:'https://stream.nightride.fm/darksynth.m4a' },
  { id:'horrorsynth', name:'Horrorsynth',  tag:'Halloween Vibes', color:'from-orange-500 to-amber-900',    stream:'https://stream.nightride.fm/horrorsynth.m4a' },
  { id:'ebsm',        name:'EBSM',         tag:'Industrial',      color:'from-slate-300 to-zinc-900',      stream:'https://stream.nightride.fm/ebsm.m4a' },
];

function MusicApp() {
  // Audio state lives in DeviceProvider so playback survives navigation.
  const { musicCurrent: current, musicPlaying: playing, musicVolume: volume, musicStatus: status,
          playStation, togglePlay, setMusicVolume } = useDevice();
  const volumeSliderRef = useRef(null);

  // Lock AppView's swipe-to-dismiss + capture all pointer events on the slider so
  // any vertical drift during a volume drag can NEVER close the app.
  useDragLockSlider(volumeSliderRef, !!current);

  // Apply src + load when current changes -- handled globally in DeviceProvider
  // Sync volume -- handled globally in DeviceProvider

  const toggle = (channel) => {
    if (current && current.id === channel.id) togglePlay();
    else playStation(channel);
  };

  return (
    <AppShell title="Music" subtitle="Live synthwave and chillwave streams from nightride.fm. Perfect coding fuel.">

      {current && (
        <Card>
          <div className="flex items-center gap-4">
            <div className={'relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ' + current.color}>
              {playing && (
                <div className="flex items-end gap-[2px]">
                  <span className="block w-[3px] animate-[pulse_0.9s_ease-in-out_infinite] bg-white" style={{ height:'10px' }} />
                  <span className="block w-[3px] animate-[pulse_1.2s_ease-in-out_infinite] bg-white" style={{ height:'18px', animationDelay:'0.15s' }} />
                  <span className="block w-[3px] animate-[pulse_0.7s_ease-in-out_infinite] bg-white" style={{ height:'14px', animationDelay:'0.3s' }} />
                  <span className="block w-[3px] animate-[pulse_1.1s_ease-in-out_infinite] bg-white" style={{ height:'22px', animationDelay:'0.05s' }} />
                </div>
              )}
              {!playing && <span className="text-2xl">🎵</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-semibold">{current.name}</p>
              <p className="text-[12px] text-white/60">{current.tag} · {status === 'loading' ? 'Connecting…' : status === 'error' ? 'Stream blocked. Try opening on nightride.fm' : (playing ? 'Now playing' : 'Paused')}</p>
            </div>
            <button onClick={() => toggle(current)}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-90">
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5l12 7-12 7V5z"/></svg>
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/60" fill="currentColor"><path d="M5 9v6h4l5 4V5L9 9H5z"/></svg>
            <input
              ref={volumeSliderRef}
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={e => setMusicVolume(parseFloat(e.target.value))}
              style={{ touchAction:'none' }}
              className="vol-slider flex-1" />
            <span className="w-8 text-right text-[11px] tabular-nums text-white/60">{Math.round(volume*100)}</span>
          </div>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-[12px] uppercase tracking-wider text-white/50">Channels</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {musicChannels.map(ch => {
            const isActive = current?.id === ch.id;
            return (
              <button key={ch.id} onClick={() => toggle(ch)}
                className={'group relative overflow-hidden rounded-2xl text-left transition active:scale-[0.97] ' +
                  (isActive ? 'ring-2 ring-white/70' : 'ring-1 ring-white/10 hover:ring-white/30')}>
                <div className={'aspect-square bg-gradient-to-br ' + ch.color} />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/20 to-transparent p-2.5">
                  <p className="text-[13px] font-semibold leading-tight text-white">{ch.name}</p>
                  <p className="text-[10px] text-white/70">{ch.tag}</p>
                </div>
                {isActive && playing && (
                  <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-black">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-[12px] uppercase tracking-wider text-white/50">About</p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/75">
          Streams provided by <span className="text-white">nightride.fm</span>, a community-run synthwave radio station.
          Some networks may block external audio streams. If a channel will not play, open the full site below.
        </p>
        <a href="https://nightride.fm" target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-white/20">
          Open nightride.fm
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
        </a>
      </Card>
    </AppShell>
  );
}

/* Standalone project app. Launches straight into a project's detail page. */
function makeProjectApp(projectId) {
  return function ProjectStandaloneApp() {
    const project = work.find(p => p.id === projectId);
    if (!project) return <AppShell title="Not found"><Card>Project missing.</Card></AppShell>;
    return (
      <div className="mx-auto max-w-md px-5">
        <Card className="!p-0 overflow-hidden">
          <div className={'aspect-[16/10] bg-gradient-to-br ' + project.color} />
        </Card>
        <h2 className="mt-5 text-[28px] font-bold leading-tight">{project.name}</h2>
        <p className="mt-1 text-[13px] text-white/60">{project.tag}</p>
        <Card className="mt-4">
          <Row label="Role" value={project.role} /><Divider />
          <Row label="Year" value={project.year} /><Divider />
          <Row label="Stack" value={project.stack} />
        </Card>
        <Card className="mt-3">
          <p className="text-[13px] uppercase tracking-wider text-white/50">Summary</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">{project.summary}</p>
        </Card>
        <Card className="mt-3">
          <p className="text-[13px] uppercase tracking-wider text-white/50">Highlights</p>
          <ul className="mt-2 space-y-2 text-[14px] text-white/85">
            {project.highlights.map(h => <li key={h}>• {h}</li>)}
          </ul>
        </Card>
      </div>
    );
  };
}

const appViews = {
  about:AboutApp, contact:ContactApp, services:ServicesApp, portfolio:PortfolioApp,
  merch:MerchApp, legal:LegalApp, blog:BlogApp, settings:SettingsApp,
  support:SupportApp, music:MusicApp,
  'project-a':makeProjectApp('project-a'),
  'project-b':makeProjectApp('project-b'),
  'project-c':makeProjectApp('project-c'),
};

/* ========================= DEVICE CHROME ========================= */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return now;
}
function fmt(d) { let h = d.getHours(); const m = d.getMinutes().toString().padStart(2,'0'); h = h % 12 || 12; return h + ':' + m; }

function StatusBar() {
  const now = useClock();
  const { toggleCc, ccOpen, openAuth, auth, themeId, profileBtnRef, themeBtnRef,
          musicBtnRef, openMiniPlayer, miniPlayerOpen, musicPlaying } = useDevice();
  const initial = auth && auth.name ? auth.name.trim().charAt(0).toUpperCase() : (auth && auth.email ? auth.email.charAt(0).toUpperCase() : '');
  const themeOrbs = (themes[themeId] && themes[themeId].orbs) || ['#c4b5fd','#67e8f9','#c4b5fd'];
  const shimmerStyle = {
    '--shim-1': themeOrbs[0],
    '--shim-2': themeOrbs[1] || themeOrbs[0],
    '--shim-3': themeOrbs[2] || themeOrbs[1] || themeOrbs[0],
  };
  return (
    <div className="flex items-center justify-between px-3 sm:px-6 text-[15px] font-semibold text-white">
      {/* LEFT: time + brand wordmark (brand hidden on small screens to free up space) */}
      <div className="flex items-center gap-2 sm:min-w-[270px]">
        <span className="tabular-nums">{fmt(now)}</span>
        <span className="inline-flex items-baseline text-[16px] font-bold tracking-tight select-none" aria-label="CreativeBuilds.dev">
          <span className="brand-shimmer" style={shimmerStyle}>CreativeBuilds</span>
          <span className="text-[13px] font-semibold text-white/55 ml-[1px]">.dev</span>
        </span>
      </div>

      {/* CENTER: Dynamic Island */}
      <div className="hidden sm:block h-[26px] w-[110px] rounded-full bg-black/90 shadow-inner ring-1 ring-white/10" />

      {/* RIGHT: music + profile + theme cluster, then signal/wifi/battery */}
      <div className="flex items-center sm:min-w-[270px] sm:justify-between pr-0 sm:pr-1">
        <div className="flex items-center gap-2 sm:gap-1.5">
          <button
            ref={musicBtnRef}
            onClick={openMiniPlayer}
            aria-label={musicPlaying ? 'Now playing' : 'Music player'}
            aria-expanded={miniPlayerOpen}
            className={'relative grid h-9 w-9 sm:h-[22px] sm:w-[22px] place-items-center rounded-full text-white transition active:scale-95 ring-1 ' +
              (miniPlayerOpen ? 'bg-white/25 ring-white/40' : 'bg-black/30 ring-white/15 hover:bg-black/45 hover:ring-white/30')}>
            {musicPlaying ? (
              <div className="flex items-end gap-[2px] sm:gap-[1.5px]">
                <span className="block w-[2.5px] sm:w-[2px] animate-[pulse_0.9s_ease-in-out_infinite] bg-white" style={{ height:'7px' }} />
                <span className="block w-[2.5px] sm:w-[2px] animate-[pulse_1.1s_ease-in-out_infinite] bg-white" style={{ height:'12px', animationDelay:'0.15s' }} />
                <span className="block w-[2.5px] sm:w-[2px] animate-[pulse_0.75s_ease-in-out_infinite] bg-white" style={{ height:'9px', animationDelay:'0.3s' }} />
              </div>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
            {musicPlaying && <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] sm:h-[6px] sm:w-[6px] rounded-full bg-fuchsia-400 ring-1 ring-black/40" />}
          </button>
          <button
            ref={profileBtnRef}
            onClick={openAuth}
            aria-label={auth ? 'Account: ' + (auth.name || auth.email) : 'Sign in'}
            className="relative grid h-9 w-9 sm:h-[22px] sm:w-[22px] place-items-center rounded-full bg-black/30 ring-1 ring-white/15 text-white transition hover:bg-black/45 hover:ring-white/30 active:scale-95">
            {auth ? (
              <span className="text-[14px] sm:text-[10px] font-semibold leading-none">{initial}</span>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.4"/>
                <path d="M4.5 19.5c1.6-3.4 4.3-5 7.5-5s5.9 1.6 7.5 5"/>
              </svg>
            )}
            {auth && <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] sm:h-[6px] sm:w-[6px] rounded-full bg-emerald-400 ring-1 ring-black/40" />}
          </button>
          <button
            ref={themeBtnRef}
            onClick={toggleCc}
            aria-label="Toggle theme"
            aria-expanded={ccOpen}
            className={'flex items-center gap-1.5 sm:gap-1 rounded-full px-3 py-2 sm:px-2.5 sm:py-1 text-[13px] sm:text-[11px] font-medium text-white ring-1 transition ' +
              (ccOpen ? 'bg-white/25 ring-white/40' : 'bg-black/30 ring-white/15 hover:bg-black/40')}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round"/>
            </svg>
            Theme
          </button>
        </div>
        {/* Signal / wifi / battery — hidden on small screens to give the action cluster breathing room */}
        <div className="hidden sm:flex items-center gap-1.5">
          <svg viewBox="0 0 18 12" className="h-3 w-4" fill="currentColor">
            <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/>
            <rect x="10" y="2" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
          </svg>
          <svg viewBox="0 0 16 12" className="h-3 w-4" fill="currentColor">
            <path d="M8 11.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm-3.6-3.5a5 5 0 0 1 7.2 0l1.4-1.4a7 7 0 0 0-10 0l1.4 1.4ZM1.6 4.5a9 9 0 0 1 12.8 0L15.8 3a11 11 0 0 0-15.6 0l1.4 1.5Z"/>
          </svg>
          <div className="flex items-center">
            <div className="relative h-[12px] w-[24px] rounded-[3px] border border-current/80">
              <div className="absolute inset-[1.5px] rounded-[1.5px] bg-current" style={{ width:'74%' }} />
            </div>
            <div className="h-[5px] w-[1.5px] rounded-r bg-current/80 ml-px" />
          </div>
        </div>
      </div>
    </div>
  );
}

const HomeIndicator = ({ onClick }) => (
  <button onClick={onClick ? () => { log('homeIndicator TAP'); onClick(); } : undefined}
    aria-label={onClick ? 'Close app' : 'Home'}
    className="group relative z-40 mx-auto mb-2 flex h-8 w-full items-end justify-center"
    style={{ paddingBottom:'max(env(safe-area-inset-bottom),8px)' }}>
    <span className="h-[5px] w-[134px] rounded-full bg-white/85 transition-all duration-300 group-hover:bg-white group-active:scale-x-90" />
  </button>
);

function Orb({ color, size, x, y, dx, dy, duration, delay = 0 }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full mix-blend-screen"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle at 35% 35%, ${color} 0%, ${color}00 70%)`,
        filter: 'blur(40px)',
        opacity: 0.55,
      }}
      animate={{
        x: [0, dx, dx * 0.4, -dx * 0.6, 0],
        y: [0, dy, dy * 0.2, dy * 0.8, 0],
        scale: [1, 1.15, 0.95, 1.08, 1],
      }}
      transition={{
        duration,
        delay,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'loop',
      }}
    />
  );
}

function Wallpaper({ theme, dimmed }) {
  const css = theme.wallpaper;
  const orbs = theme.orbs || ['#ffffff','#ffffff','#ffffff'];
  return (
    <motion.div key={theme.id} initial={{ opacity:0 }} animate={{ opacity:1 }}
      transition={{ duration:0.8, ease:[0.22,1,0.36,1] }}
      className="absolute inset-0 overflow-hidden" style={{ background:css }}>

      {/* Animated decoration only renders while no app is open. The wallpaper is
          fully covered by the AppView during/after morph, so unmounting these
          frees GPU/paint work and removes contention with the morph spring. */}
      {!dimmed && (
        <>
          <Orb color={orbs[0]} size={520} x="-10%" y="-5%"  dx={140} dy={90}  duration={26} />
          <Orb color={orbs[1]} size={460} x="55%"  y="15%"  dx={-120} dy={120} duration={32} delay={4} />
          <Orb color={orbs[2]} size={580} x="20%"  y="55%"  dx={100} dy={-90} duration={38} delay={9} />
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background:css, opacity:0.55, mixBlendMode:'overlay' }}
            animate={{ filter:['hue-rotate(0deg)','hue-rotate(20deg)','hue-rotate(-15deg)','hue-rotate(0deg)'] }}
            transition={{ duration:40, repeat:Infinity, ease:'easeInOut' }}
          />
        </>
      )}

      {/* grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage:"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")" }} />

      {dimmed && <motion.div initial={{ opacity:0 }} animate={{ opacity:0.35 }} exit={{ opacity:0 }} transition={{ duration:0.18 }} className="absolute inset-0 bg-black" />}
    </motion.div>
  );
}

/* ========================= ICON / GRID / DOCK ========================= */
function AppIcon({ app, onTap, showLabel = true, size = 62 }) {
  const handle = () => {
    log('icon TAP', { id: app.id, href: app.href || null });
    if (app.href) window.open(app.href,'_blank','noopener,noreferrer');
    else onTap(app);
  };
  return (
    <button onClick={handle} aria-label={'Open ' + app.label}
      className="group flex flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-2xl">
      <motion.div layoutId={'app-tile-' + app.id} className="icon-shadow relative overflow-hidden"
        style={{ width:size, height:size, borderRadius:size*0.28, background:app.tile }}
        whileTap={{ scale:0.88 }} transition={{ type:'spring', stiffness:400, damping:28 }}>
        <span className="pointer-events-none absolute inset-0"
          style={{ background:'linear-gradient(180deg,rgba(255,255,255,0.28) 0%,rgba(255,255,255,0) 35%,rgba(0,0,0,0.18) 100%)' }} />
        <motion.div layoutId={'app-glyph-' + app.id}
          className="absolute inset-0 grid place-items-center text-[28px] leading-none text-white">{app.glyph}</motion.div>
      </motion.div>
      {showLabel && <motion.span layoutId={'app-label-' + app.id}
        className="text-[13px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{app.label}</motion.span>}
    </button>
  );
}

const PAGE_SIZE = 20; // 4 cols x 5 rows per page

function HomeGrid() {
  const { openApp, setHomePage, appOrder } = useDevice();
  const scrollerRef = React.useRef(null);

  // Resolve the effective ordered apps (merge persisted order with current homeApps).
  // We keep this here so previously-saved orders still apply; new sessions just use
  // the default homeApps order. Reordering UI was removed.
  const orderedApps = React.useMemo(() => {
    const byId = Object.fromEntries(homeApps.map(a => [a.id, a]));
    const baseIds = appOrder && Array.isArray(appOrder) ? appOrder : homeApps.map(a => a.id);
    const seen = new Set();
    const out = [];
    for (const id of baseIds) { if (byId[id] && !seen.has(id)) { out.push(byId[id]); seen.add(id); } }
    for (const a of homeApps) { if (!seen.has(a.id)) { out.push(a); seen.add(a.id); } }
    return out;
  }, [appOrder]);

  const fullPages = Math.ceil(orderedApps.length / PAGE_SIZE) || 0;
  const pages = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < fullPages; i++) out.push(orderedApps.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE));
    out.push([]);
    return out;
  }, [fullPages, orderedApps]);

  const onScroll = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setHomePage(idx);
  }, [setHomePage]);

  /* ---------- Page-swipe drag (desktop mouse) ---------- */
  const dragRef = React.useRef({ active:false, startX:0, startScroll:0, moved:false });
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = scrollerRef.current; if (!el) return;
    dragRef.current = { active:true, startX:e.clientX, startScroll:el.scrollLeft, moved:false };
    el.style.cursor = 'grabbing';
    el.style.scrollSnapType = 'none';
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const el = scrollerRef.current; if (!el) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) { dragRef.current.moved = true; }
    el.scrollLeft = dragRef.current.startScroll - dx;
  };
  const endDrag = () => {
    if (!dragRef.current.active) return;
    const el = scrollerRef.current;
    dragRef.current.active = false;
    if (!el) return;
    el.style.cursor = '';
    const w = el.clientWidth;
    const idx = Math.round(el.scrollLeft / w);
    el.scrollTo({ left: idx * w, behavior:'smooth' });
    setTimeout(() => { if (el) el.style.scrollSnapType = 'x mandatory'; }, 320);
  };
  const onClickCapture = (e) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current.moved = false;
    }
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollerRef}
        data-home-scroller
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className="h-full w-full overflow-x-auto overflow-y-hidden no-scrollbar select-none cursor-grab"
        style={{ scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', touchAction:'pan-x' }}
      >
        <div className="flex h-full" style={{ width: (pages.length * 100) + '%' }}>
          {pages.map((apps, pageIdx) => (
            <section
              key={pageIdx}
              className="h-full shrink-0"
              style={{ width: (100 / pages.length) + '%', scrollSnapAlign:'start' }}
            >
              <div className="mx-auto h-full w-full max-w-2xl px-8 pt-6">
                {apps.length === 0 ? (
                  <div className="flex h-[60%] flex-col items-center justify-center text-center">
                    <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-white/10 text-white/60">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/>
                        <rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>
                      </svg>
                    </div>
                    <p className="text-[14px] font-medium text-white/75">Space for more</p>
                    <p className="mt-1 text-[12px] text-white/45">Add new apps and they’ll appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-x-6 gap-y-5">
                    {apps.map((app) => (
                      <div key={app.id} className="flex justify-center">
                        <AppIcon app={app} onTap={a => openApp(a.id)} size={70} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Reusable dots, driven by context. */
function PageDots() {
  const { homePage, setHomePage } = useDevice();
  const fullPages = Math.ceil(homeApps.length / PAGE_SIZE) || 0;
  const total = fullPages + 1;
  const scrollTo = (idx) => {
    setHomePage(idx);
    // Smooth-scroll the scroller; find it by traversing from document
    const scroller = document.querySelector('[data-home-scroller]');
    if (scroller) scroller.scrollTo({ left: idx * scroller.clientWidth, behavior: 'smooth' });
  };
  return (
    <div className="flex items-center justify-center gap-2 pb-3">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => scrollTo(i)} aria-label={`Go to page ${i + 1}`}
          className={'transition-all duration-300 rounded-full ' +
            (i === homePage ? 'bg-white h-1.5 w-5' : 'bg-white/45 h-1.5 w-1.5 hover:bg-white/70')} />
      ))}
    </div>
  );
}

function Dock() {
  const { openApp } = useDevice();
  return (
    <div className="px-6 pb-2">
      <div className="mx-auto w-full max-w-2xl">
        <div className="glass-liquid rounded-[36px] px-6 py-4">
          <div className="flex items-end justify-around gap-2">
            {dockApps.map(app => (
              <AppIcon key={app.id} app={app} onTap={a => openApp(a.id)} showLabel={true} size={62} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================= APP VIEW (morph or cross-app slide) ========================= */
function AppView({ app, onClose }) {
  const { openAppId, prevAppId, openApp, dragLocked } = useDevice();
  const View = appViews[app.id];

  // Capture entry mode ONCE at mount so close behavior is stable.
  const entryRef = React.useRef(null);
  if (entryRef.current === null) {
    entryRef.current = {
      crossNav: !!prevAppId && prevAppId !== app.id,
      fromAppId: (prevAppId && prevAppId !== app.id) ? prevAppId : null,
    };
  }
  const { crossNav: enteredViaCrossNav, fromAppId } = entryRef.current;
  const fromApp = fromAppId ? getApp(fromAppId) : null;

  // Lock exit mode the moment this view stops being the active app. Without this,
  // a still-mounted exiting AppView re-renders on every openAppId change and can
  // flip isBeingReplaced back to false (e.g. close → open another → close again),
  // which restores layoutId mid-exit and strands the view at fullscreen.
  const exitModeRef = React.useRef(null);
  if (openAppId !== app.id) {
    if (!exitModeRef.current) {
      exitModeRef.current = openAppId ? 'replaced' : 'closed';
      log('AppView exitMode LOCK', { id: app.id, mode: exitModeRef.current, openAppId });
    } else if (exitModeRef.current === 'closed' && openAppId) {
      exitModeRef.current = 'replaced';
      log('AppView exitMode UPGRADE', { id: app.id, openAppId });
    }
  }
  const isBeingReplaced = exitModeRef.current === 'replaced';
  const skipMorph = enteredViaCrossNav || isBeingReplaced;

  const y = useMotionValue(0);
  const scale = useTransform(y, [0,300], [1,0.85]);
  const opacity = useTransform(y, [0,300], [1,0.4]);
  useEffect(() => {
    log('AppView MOUNT', { id: app.id, openAppId, prevAppId, skipMorph, enteredViaCrossNav, isBeingReplaced });
    document.body.style.overflow = 'hidden';
    return () => {
      log('AppView UNMOUNT', { id: app.id });
      document.body.style.overflow = '';
    };
  }, []);

  const containerLayoutId   = skipMorph ? undefined : ('app-tile-'  + app.id);
  const glyphLayoutId       = skipMorph ? undefined : ('app-glyph-' + app.id);
  const labelLayoutId       = skipMorph ? undefined : ('app-label-' + app.id);

  const containerInitial = enteredViaCrossNav ? { x: '100%', opacity: 0.6, scale: 1 } : false;
  const containerAnimate = { x: 0, opacity: 1, scale: 1 };
  // Exit: if being replaced by another app, slide out left.
  // If being closed (X) and we entered via cross-nav, slide down + fade (no icon to morph to).
  // Otherwise let layoutId handle the morph back to the home icon.
  const containerExit = isBeingReplaced
    ? { x: '-22%', opacity: 0 }
    : (enteredViaCrossNav ? { y: 80, opacity: 0, scale: 0.96 } : undefined);
  // Tween (not spring) for the open/close layout morph so timing is bounded and
  // identical every cycle. Springs can take longer to settle when interrupted,
  // which is what was leaving the layoutId tracker in a stale state during
  // rapid app-to-app cycling on mobile.
  const containerTransition = enteredViaCrossNav && !isBeingReplaced
    ? { type:'tween', duration:0.42, ease:[0.22,1,0.36,1] }
    : isBeingReplaced
      ? { type:'tween', duration:0.32, ease:[0.4,0,0.2,1] }
      : { type:'tween', duration:0.30, ease:[0.32,0.72,0,1] };

  log('AppView RENDER', { id: app.id, layoutId: containerLayoutId, hasExplicitExit: containerExit !== undefined, exitMode: exitModeRef.current });
  // Two-layer structure (deliberate): the OUTER motion.div owns the layoutId
  // morph and the open/close/cross-nav animation (initial/animate/exit). The
  // INNER motion.div owns drag-to-dismiss feedback via motion values for y,
  // scale, and opacity. They are kept on different elements because driving
  // the same prop from both `style` (motion value) and `animate`/`initial`/`exit`
  // (fixed numbers) produced "undefined" reads during framer-motion's layoutId
  // projection snapshot, which the browser logged as `style.borderTopLeftRadius:
  // undefined`, `style.opacity: undefined`, etc.
  return (
    <motion.div layoutId={containerLayoutId}
      data-cb-appview={app.id}
      className="fixed inset-0 z-40 overflow-hidden bg-neutral-950"
      // When we entered via cross-nav (no morph) there's no reason to show the source tile
      // gradient — go straight to the dark app background to avoid a flash of pink/blue.
      // When we DO morph from the home icon we need the tile colour briefly so the
      // layoutId animation has matching colours between source and destination.
      style={{ background: skipMorph ? '#0a0a0a' : app.tile, borderRadius: 0 }}
      initial={containerInitial}
      animate={containerAnimate}
      exit={containerExit}
      onAnimationStart={(def) => log('AppView animStart', { id: app.id, def })}
      onAnimationComplete={(def) => log('AppView animComplete', { id: app.id, def })}
      onLayoutAnimationStart={() => log('AppView layoutStart', { id: app.id })}
      onLayoutAnimationComplete={() => log('AppView layoutComplete', { id: app.id })}
      transition={containerTransition}>
      <motion.div
        className="absolute inset-0"
        style={{ y, scale, opacity }}
        drag={(skipMorph || dragLocked) ? false : 'y'}
        dragConstraints={{ top:0, bottom:0 }}
        dragElastic={{ top:0, bottom:0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > 140 || info.velocity.y > 600) onClose(); }}>
      {/* Header and section render at full opacity from t=0 so the page content is
          visible throughout the morph (iOS-style: content scales with the icon as it
          expands). The section's bg-neutral-950 immediately covers the tile gradient
          inside the morphing container so we don't need a separate dark overlay. */}
      <motion.header
        initial={enteredViaCrossNav ? { opacity:0 } : false}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        transition={enteredViaCrossNav ? { delay:0.05, duration:0.20 } : { duration:0.18 }}
        className="absolute inset-x-0 top-0 z-20"
        style={{ paddingTop:'max(env(safe-area-inset-top),12px)' }}>
        <div className="flex items-center justify-between gap-3 px-4 pt-12 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            {fromApp && (
              <button onClick={() => openApp(fromApp.id)} aria-label={'Back to ' + fromApp.label}
                className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-md transition hover:bg-white/25 active:scale-95">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span className="whitespace-nowrap pr-0.5">{fromApp.label}</span>
              </button>
            )}
            <motion.div layoutId={glyphLayoutId}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[20px]" style={{ background:app.tile }}>{app.glyph}</motion.div>
            <motion.h1 layoutId={labelLayoutId} className="truncate text-[17px] font-semibold text-white">{app.label}</motion.h1>
          </div>
          <button onClick={() => { log('close X TAP', { id: app.id }); onClose(); }} aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 active:scale-90">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        </div>
      </motion.header>
      <motion.section
        initial={enteredViaCrossNav ? { opacity:0 } : false}
        animate={{ opacity:1 }}
        exit={{ opacity:0 }}
        transition={enteredViaCrossNav ? { delay:0.08, duration:0.24, ease:[0.22,1,0.36,1] } : { duration:0.18, ease:[0.22,1,0.36,1] }}
        className="no-scrollbar absolute inset-0 overflow-y-auto bg-neutral-950 text-white"
        data-app-section
        style={{ paddingTop:'calc(max(env(safe-area-inset-top),12px) + 84px)',
                 paddingBottom:'calc(max(env(safe-area-inset-bottom),12px) + 40px)' }}>
        {View ? <View /> : <div className="px-6"><p className="text-white/70">No view for {app.label}</p></div>}
      </motion.section>
      </motion.div>
    </motion.div>
  );
}

/* ========================= CONTROL CENTER ========================= */
function ControlCenter() {
  const { themeId, setTheme, ccOpen, closeCc, themeBtnRef } = useDevice();
  return (
    <Popover open={ccOpen} onClose={closeCc} anchorRef={themeBtnRef} width={320}>
      <PopoverHeader title="Appearance" onClose={closeCc} />
      <div className="grid grid-cols-2 gap-2.5">
        {themeOrder.map(id => {
          const t = themes[id], active = id === themeId;
          return (
            <button key={id} onClick={() => { setTheme(id); closeCc(); }}
              className={'group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl p-2 text-left transition ' +
                (active ? 'ring-2 ring-white' : 'ring-1 ring-white/15 hover:ring-white/30')}
              style={{ background:'rgba(255,255,255,0.06)' }}>
              <div className="h-16 w-full rounded-xl" style={{ background:t.wallpaper }} />
              <div className="flex w-full items-center justify-between px-1">
                <span className="text-[12px] font-medium">{t.name}</span>
                {active && (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-black">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-[11px] text-white/60">Tip: tap a tile to change the wallpaper &amp; glass tint instantly.</p>
    </Popover>
  );
}

/* ========================= AUTH SHEET (mock client-side) ========================= */
function useMediaQuery(query) {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    setMatches(mql.matches);
    return () => { mql.removeEventListener ? mql.removeEventListener('change', onChange) : mql.removeListener(onChange); };
  }, [query]);
  return matches;
}

/* When you start interacting with a slider (or any in-app control), we MUST guarantee
   the host AppView won't accidentally trigger its swipe-to-dismiss gesture. A range input's
   track is only a few pixels tall, so any vertical pointer drift during a drag immediately
   hits the parent motion.div. We defeat this two ways at once:
     1) setPointerCapture() routes ALL subsequent pointer events for that pointer back to
        the slider, no matter where the cursor wanders.
     2) lockDrag() flips a context flag that AppView reads to disable its `drag` prop entirely
        for the duration of the interaction — belt and braces.
   Capture-phase listeners ensure we run before Framer Motion's bubble-phase handlers. */
function useDragLockSlider(ref, enabled = true) {
  const { lockDrag, unlockDrag } = useDevice();
  React.useEffect(() => {
    if (!enabled) return;
    const el = ref && ref.current;
    if (!el) return;
    const activePointers = new Set();
    const onDown = (e) => {
      activePointers.add(e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      lockDrag();
      e.stopPropagation();
    };
    const onMove = (e) => { if (activePointers.size) e.stopPropagation(); };
    const release = (e) => {
      if (e && e.pointerId != null) {
        activePointers.delete(e.pointerId);
        try { el.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      } else {
        activePointers.clear();
      }
      if (activePointers.size === 0) unlockDrag();
    };
    const onTouchBlock = (e) => e.stopPropagation();
    // Capture-phase so we beat Framer Motion's bubble-phase listeners.
    el.addEventListener('pointerdown',   onDown,       true);
    el.addEventListener('pointermove',   onMove,       true);
    el.addEventListener('pointerup',     release,      true);
    el.addEventListener('pointercancel', release,      true);
    el.addEventListener('lostpointercapture', release, true);
    el.addEventListener('touchstart',    onTouchBlock, { capture: true, passive: true });
    el.addEventListener('touchmove',     onTouchBlock, { capture: true, passive: true });
    el.addEventListener('mousedown',     onTouchBlock, true);
    // Failsafe: if the window loses the pointer entirely (e.g. user releases off-screen),
    // make absolutely sure we unlock so the user is never stuck in a locked state.
    const windowRelease = () => { if (activePointers.size) { activePointers.clear(); unlockDrag(); } };
    window.addEventListener('pointerup',     windowRelease, true);
    window.addEventListener('pointercancel', windowRelease, true);
    window.addEventListener('blur',          windowRelease);
    return () => {
      el.removeEventListener('pointerdown',   onDown,       true);
      el.removeEventListener('pointermove',   onMove,       true);
      el.removeEventListener('pointerup',     release,      true);
      el.removeEventListener('pointercancel', release,      true);
      el.removeEventListener('lostpointercapture', release, true);
      el.removeEventListener('touchstart',    onTouchBlock, { capture: true });
      el.removeEventListener('touchmove',     onTouchBlock, { capture: true });
      el.removeEventListener('mousedown',     onTouchBlock, true);
      window.removeEventListener('pointerup',     windowRelease, true);
      window.removeEventListener('pointercancel', windowRelease, true);
      window.removeEventListener('blur',          windowRelease);
      if (activePointers.size) unlockDrag();
    };
  }, [ref, enabled, lockDrag, unlockDrag]);
}

/* ========================= POPOVER (shared by Theme / Auth / MiniPlayer) =========================
   Anchored dropdown on desktop (with notch under the source button) or bottom-sheet on mobile.
   All three top-bar popovers use the same loading sequence + spring physics for a unified feel. */
function Popover({ open, onClose, anchorRef, width = 320, panelClassName = '', children }) {
  // 640px matches Tailwind's `sm:` breakpoint used by the StatusBar so the popover's
  // desktop/mobile mode flips in lockstep with the trigger button's responsive styling.
  const isDesktop = useMediaQuery('(min-width: 640px)');

  // Synchronously measure the anchor button. We do this during render (not in an effect)
  // so the very first paint already has the correct position — eliminates the brief
  // position jump that useLayoutEffect would otherwise cause.
  const measure = React.useCallback(() => {
    const node = anchorRef && anchorRef.current;
    if (!node || typeof window === 'undefined') return { rightFromVw: 200, top: 58 };
    const r = node.getBoundingClientRect();
    return { rightFromVw: window.innerWidth - (r.left + r.width / 2), top: r.bottom + 12 };
  }, [anchorRef]);

  const [anchor, setAnchor] = React.useState(measure);
  // Re-measure synchronously the moment `open` flips false→true so the entrance animation
  // starts from the correct on-screen coordinates. Pattern recommended by the React docs
  // for state derived from props during render.
  const prevOpenRef = React.useRef(open);
  if (open && !prevOpenRef.current) {
    const next = measure();
    if (next.rightFromVw !== anchor.rightFromVw || next.top !== anchor.top) {
      setAnchor(next);
    }
  }
  prevOpenRef.current = open;

  // Keep position fresh while open (window resize, button reflow, etc.).
  React.useEffect(() => {
    if (!open || !isDesktop) return;
    const onResize = () => setAnchor(measure());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, isDesktop, measure]);

  // Notch lines up under the source button (right edge of panel sits 12px from viewport right;
  // notch is 12px wide → offset by 18px so its center matches the button center).
  const notchRightPx = Math.max(8, anchor.rightFromVw - 18);

  const wrapClass = isDesktop
    ? 'fixed z-[80]'
    : 'fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-md';
  const wrapStyle = isDesktop
    ? { top: anchor.top, right: 12, width, transformOrigin: (width - notchRightPx) + 'px 0px',
        // Force the panel onto its own compositor layer up-front so backdrop-filter
        // doesn't have to recompute (which is what caused the "gray flash" on open).
        isolation: 'isolate', willChange: 'transform' }
    : { paddingBottom: 'max(env(safe-area-inset-bottom),12px)',
        isolation: 'isolate', willChange: 'transform' };
  const cardClass = (isDesktop
    ? 'glass-liquid rounded-2xl p-4 text-white ring-1 ring-white/15 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] '
    : 'glass-liquid mx-3 mb-3 rounded-[28px] p-4 text-white ring-1 ring-white/15 ') + panelClassName;

  // IMPORTANT: We do NOT animate the panel's opacity. backdrop-filter cannot composite
  // through an opacity transition — the glass would render gray until opacity hit 1.
  // The scrim provides the fade affordance; the panel slides + scales in at full opacity.
  const initial    = isDesktop ? { y:-16, scale:0.96 } : { y:'100%' };
  const animate    = isDesktop ? { y:0,   scale:1    } : { y:0 };
  const exitTo     = isDesktop ? { y:-12, scale:0.96, opacity:0 } : { y:'100%' };
  const transition = isDesktop
    ? { type:'spring', stiffness:360, damping:30 }
    : { type:'spring', stiffness:320, damping:34 };

  return (
    <AnimatePresence>
      {open && (
        <React.Fragment>
          <motion.div key="pop-scrim"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.18 }}
            onClick={onClose}
            className={'fixed inset-0 z-[70] ' + (isDesktop ? 'bg-black/30' : 'bg-black/55 backdrop-blur-md')} />
          <motion.div key="pop-panel"
            initial={initial} animate={animate} exit={exitTo}
            transition={transition}
            className={wrapClass} style={wrapStyle}>
            {isDesktop && (
              <div
                className="absolute -top-[7px] h-3 w-3 rotate-45 rounded-[3px] bg-white/10 ring-1 ring-white/15"
                style={{ right: notchRightPx }} />
            )}
            <div className={cardClass}>
              {children}
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}

/* Small reusable header (title + close button) for all popovers. */
function PopoverHeader({ title, onClose }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <button onClick={onClose} aria-label="Close"
        className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
      </button>
    </div>
  );
}

function AuthSheet() {
  const { authOpen, closeAuth, auth, setAuth, profileBtnRef } = useDevice();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!authOpen) { setStatus(null); setPassword(''); }
  }, [authOpen]);

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const submit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!validEmail(cleanEmail)) { setStatus({ type:'err', msg:'Please enter a valid email address.' }); return; }
    if (mode === 'reset') {
      setStatus({ type:'ok', msg:'If an account exists for ' + cleanEmail + ', a reset link is on its way.' });
      return;
    }
    if (password.length < 6) { setStatus({ type:'err', msg:'Passwords need to be at least 6 characters.' }); return; }
    if (mode === 'register' && !name.trim()) { setStatus({ type:'err', msg:'What should I call you?' }); return; }
    const user = { email: cleanEmail, name: name.trim() || cleanEmail.split('@')[0], createdAt: Date.now() };
    setAuth(user);
    setStatus({ type:'ok', msg: mode === 'register' ? 'Account created. Welcome aboard.' : 'Signed in.' });
    setTimeout(() => closeAuth(), 650);
  };

  const signOut = () => { setAuth(null); setStatus({ type:'ok', msg:'Signed out.' }); };

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => { setMode(id); setStatus(null); }}
      className={'flex-1 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ' +
        (mode === id ? 'bg-white text-neutral-900' : 'text-white/70 hover:text-white')}>
      {label}
    </button>
  );

  const title = auth
    ? 'Your account'
    : (mode === 'reset' ? 'Reset password' : (mode === 'register' ? 'Create account' : 'Sign in'));

  return (
    <Popover open={authOpen} onClose={closeAuth} anchorRef={profileBtnRef} width={340}>
      <PopoverHeader title={title} onClose={closeAuth} />
      {auth ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-700 text-[15px] font-bold">
              {(auth.name || auth.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{auth.name || 'Guest'}</p>
              <p className="truncate text-[12px] text-white/65">{auth.email}</p>
            </div>
            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-300/30">Active</span>
          </div>
          <p className="px-1 text-[11px] text-white/55">
            This is a demo account stored only in your browser. No data is sent anywhere.
          </p>
          <button onClick={signOut}
            className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 active:scale-[0.98]">
            Sign out
          </button>
          {status && (
            <p className={'px-1 text-[12px] ' + (status.type === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>{status.msg}</p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
            {tabBtn('signin',   'Sign in')}
            {tabBtn('register', 'Register')}
            {tabBtn('reset',    'Reset')}
          </div>
          {mode === 'register' && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-white/70">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} type="text" autoComplete="name" placeholder="What should I call you?"
                className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px] text-white placeholder-white/40 ring-1 ring-white/15 outline-none transition focus:bg-white/15 focus:ring-white/40" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-white/70">Email</span>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required
              className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px] text-white placeholder-white/40 ring-1 ring-white/15 outline-none transition focus:bg-white/15 focus:ring-white/40" />
          </label>
          {mode !== 'reset' && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-white/70">Password</span>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                className="w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px] text-white placeholder-white/40 ring-1 ring-white/15 outline-none transition focus:bg-white/15 focus:ring-white/40" />
            </label>
          )}
          {status && (
            <p className={'px-1 text-[12px] ' + (status.type === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>{status.msg}</p>
          )}
          <button type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_-10px_rgba(139,92,246,0.7)] ring-1 ring-white/20 transition hover:brightness-110 active:scale-[0.98]">
            {mode === 'reset' ? 'Send reset link' : (mode === 'register' ? 'Create account' : 'Sign in')}
          </button>
          <p className="px-1 text-center text-[11px] text-white/50">
            Demo authentication. Credentials stay in your browser and never reach a server.
          </p>
        </form>
      )}
    </Popover>
  );
}

/* ========================= MINI PLAYER (now-playing popover) ========================= */
function MiniPlayer() {
  const { miniPlayerOpen, closeMiniPlayer, musicBtnRef,
          musicCurrent: current, musicPlaying: playing, musicVolume: volume, musicStatus: status,
          playStation, togglePlay, setMusicVolume, openApp } = useDevice();
  const volumeSliderRef = useRef(null);

  // Same drag-lock pattern as MusicApp's slider.
  useDragLockSlider(volumeSliderRef, miniPlayerOpen);

  const statusLabel = status === 'loading' ? 'Connecting…'
    : status === 'error' ? 'Stream blocked'
    : (playing ? 'Now playing' : (current ? 'Paused' : 'Nothing playing'));

  return (
    <Popover open={miniPlayerOpen} onClose={closeMiniPlayer} anchorRef={musicBtnRef} width={320}>
      <PopoverHeader title="Now Playing" onClose={closeMiniPlayer} />

      {/* Track card */}
      <div className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 ring-1 ring-white/10">
        <div className={'relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl ' +
          (current ? ('bg-gradient-to-br ' + current.color) : 'bg-white/10')}>
          {playing ? (
            <div className="flex items-end gap-[2px]">
              <span className="block w-[3px] animate-[pulse_0.9s_ease-in-out_infinite] bg-white" style={{ height:'8px' }} />
              <span className="block w-[3px] animate-[pulse_1.2s_ease-in-out_infinite] bg-white" style={{ height:'16px', animationDelay:'0.15s' }} />
              <span className="block w-[3px] animate-[pulse_0.7s_ease-in-out_infinite] bg-white" style={{ height:'12px', animationDelay:'0.3s' }} />
              <span className="block w-[3px] animate-[pulse_1.1s_ease-in-out_infinite] bg-white" style={{ height:'20px', animationDelay:'0.05s' }} />
            </div>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white/70" fill="currentColor"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{current ? current.name : 'Pick a channel'}</p>
          <p className="truncate text-[11px] text-white/60">{current ? (current.tag + ' · ' + statusLabel) : 'Synthwave radio from nightride.fm'}</p>
        </div>
        <button onClick={() => current ? togglePlay() : playStation(musicChannels[0])}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-black transition active:scale-90 disabled:opacity-50"
          aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5l12 7-12 7V5z"/></svg>
          )}
        </button>
      </div>

      {/* Volume */}
      <div className="mt-3 flex items-center gap-3 px-1">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/60" fill="currentColor"><path d="M5 9v6h4l5 4V5L9 9H5z"/></svg>
        <input
          ref={volumeSliderRef}
          type="range" min="0" max="1" step="0.01" value={volume}
          onChange={e => setMusicVolume(parseFloat(e.target.value))}
          style={{ touchAction:'none' }}
          className="vol-slider flex-1" />
        <span className="w-8 text-right text-[11px] tabular-nums text-white/60">{Math.round(volume*100)}</span>
      </div>

      {/* Quick channel chips */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {musicChannels.slice(0, 6).map(ch => {
          const isActive = current && current.id === ch.id;
          return (
            <button key={ch.id} onClick={() => isActive ? togglePlay() : playStation(ch)}
              className={'group relative overflow-hidden rounded-xl text-left transition active:scale-[0.97] ' +
                (isActive ? 'ring-2 ring-white/80' : 'ring-1 ring-white/10 hover:ring-white/30')}>
              <div className={'aspect-[16/10] bg-gradient-to-br ' + ch.color} />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5">
                <p className="truncate text-[10px] font-semibold leading-tight text-white">{ch.name}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => { closeMiniPlayer(); openApp('music'); }}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 active:scale-[0.98]">
          Open Music app
        </button>
        <a href="https://nightride.fm" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-3 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_-10px_rgba(139,92,246,0.7)] ring-1 ring-white/20 transition hover:brightness-110 active:scale-[0.98]">
          nightride.fm
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
        </a>
      </div>
    </Popover>
  );
}

/* ========================= DEVICE ROOT ========================= */
function Device() {
  const { themeId, openAppId, closeApp, audioRef } = useDevice();
  const theme = themes[themeId];

  // Whenever openAppId changes, log the new value and 800ms later count how
  // many [data-cb-appview] containers are actually in the DOM. If openAppId is
  // null but a container is still mounted, we're stranded — that's the stuck
  // bug, captured automatically.
  useEffect(() => {
    log('Device openAppId changed', { openAppId });
    const t = setTimeout(() => {
      if (typeof document === 'undefined') return;
      const mounted = Array.from(document.querySelectorAll('[data-cb-appview]')).map(el => el.getAttribute('data-cb-appview'));
      log('Device DOM check', { openAppId, mountedAppViews: mounted });
      if (!openAppId && mounted.length > 0) {
        console.warn(`[CB ${LOG_VERSION} STUCK] openAppId is null but AppView still in DOM:`, mounted);
        document.querySelectorAll('[data-cb-appview]').forEach(el => {
          const cs = el.getAttribute('style') || '(none)';
          const r = el.getBoundingClientRect();
          console.warn(`[CB ${LOG_VERSION} STUCK] stranded id=${el.getAttribute('data-cb-appview')} rect=${r.width}x${r.height}@${r.left},${r.top} style="${cs}"`);
        });
      }
      if (openAppId && mounted.length > 1) {
        console.warn(`[CB ${LOG_VERSION} OVERLAP] multiple AppViews mounted simultaneously:`, mounted);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [openAppId]);
  const openedApp = openAppId ? getApp(openAppId) : null;
  return (
    <div className="relative h-full w-full overflow-hidden font-sf">
      <Wallpaper theme={theme} dimmed={!!openAppId} />
      <LayoutGroup>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50">
          {/* Legibility scrim: fades dark-translucent → transparent so the white
              status-bar text and brand wordmark stay readable on bright/blueish
              wallpapers without making the area look like a solid bar. */}
          <div aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[110px] bg-gradient-to-b from-black/50 via-black/20 to-transparent" />
          <div className="relative pointer-events-auto" style={{ paddingTop:'max(env(safe-area-inset-top),12px)' }}>
            <StatusBar />
          </div>
        </div>
        <ControlCenter />
        <div className="absolute inset-0 flex flex-col">
          <div className="h-[calc(env(safe-area-inset-top,0px)+44px)] shrink-0" />
          <div className="flex-1 overflow-hidden"><HomeGrid /></div>
          {/* Page indicator dots above the dock */}
          <PageDots />
          <Dock />
          <HomeIndicator onClick={openAppId ? closeApp : undefined} />
        </div>
        {/* sync (default): allow the next app to enter while the previous one exits.
            mode="wait" deadlocked when an exit was corrupted; frozen exitModeRef
            keeps each exiting view's animation props stable regardless. */}
        <AnimatePresence>
          {openedApp && <AppView key={openedApp.id} app={openedApp} onClose={closeApp} />}
        </AnimatePresence>
        <AuthSheet />
        <MiniPlayer />
      </LayoutGroup>
      {/* Persistent audio element — mounted once at root so playback survives app navigation. */}
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
    </div>
  );
}

function App() {
  return (
    <DeviceProvider>
      <Device />
    </DeviceProvider>
  );
}

/* ========================= BOOT ========================= */
createRoot(document.getElementById('root')).render(<App />);
requestAnimationFrame(() => {
  const boot = document.getElementById('boot');
  if (boot) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 600); }
});
