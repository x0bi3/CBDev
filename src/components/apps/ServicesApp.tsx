import { AppShell, Card } from './AppShell';

const services = [
  { icon: '🎨', title: 'Design Systems', body: 'Token-driven UI libraries that scale from MVP to enterprise.' },
  { icon: '🌐', title: 'Web Apps', body: 'React, Next.js, and TypeScript with a focus on performance.' },
  { icon: '✨', title: 'WebGL & 3D', body: 'three.js, shaders, and immersive scroll-driven storytelling.' },
  { icon: '⚡', title: 'Performance', body: 'Lighthouse 95+, Core Web Vitals, and bundle surgery.' },
  { icon: '♿', title: 'Accessibility', body: 'WCAG 2.2 AA audits and motion-safe alternatives.' },
];

export function ServicesApp() {
  return (
    <AppShell title="Services" subtitle="What I can help you ship.">
      {services.map((s) => (
        <Card key={s.title}>
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl">
              {s.icon}
            </div>
            <div>
              <p className="text-[16px] font-semibold">{s.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/70">{s.body}</p>
            </div>
          </div>
        </Card>
      ))}
    </AppShell>
  );
}
