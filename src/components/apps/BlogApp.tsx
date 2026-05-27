import { AppShell, Card } from './AppShell';

const posts = [
  { title: 'Shipping a Lighthouse-100 React app in 2025', date: 'Nov 04', read: '8 min' },
  { title: 'GLSL for designers — a gentle on-ramp', date: 'Oct 18', read: '12 min' },
  { title: 'Choreographing scroll with GSAP & Lenis', date: 'Sep 27', read: '6 min' },
  { title: 'Design tokens that actually scale', date: 'Aug 12', read: '9 min' },
];

export function BlogApp() {
  return (
    <AppShell title="Blog" subtitle="Notes from the workshop.">
      {posts.map((p) => (
        <Card key={p.title}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold leading-snug">{p.title}</p>
              <p className="mt-1 text-[12px] text-white/55">
                {p.date} · {p.read}
              </p>
            </div>
            <span className="mt-1 text-white/40">›</span>
          </div>
        </Card>
      ))}
    </AppShell>
  );
}
