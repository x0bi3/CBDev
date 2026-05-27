import { AppShell, Card, Divider, Row } from './AppShell';

export function ProjectApp() {
  return (
    <AppShell title="Project" subtitle="A deep-dive case study.">
      <Card className="!p-0 overflow-hidden">
        <div className="aspect-[16/10] bg-gradient-to-br from-cyan-400 via-sky-600 to-indigo-900" />
      </Card>

      <Card>
        <Row label="Client" value="Confidential" />
        <Divider />
        <Row label="Year" value="2024" />
        <Divider />
        <Row label="Role" value="Lead Frontend" />
        <Divider />
        <Row label="Stack" value="Next · R3F · GSAP" />
      </Card>

      <Card>
        <p className="text-[13px] uppercase tracking-wider text-white/50">Summary</p>
        <p className="mt-2 text-[14px] leading-relaxed text-white/80">
          A bold marketing experience that pairs an interactive 3D hero with a
          scroll-driven product reveal. Achieved Lighthouse 96 on mobile while
          shipping 12 custom shaders and a fully accessible reduced-motion path.
        </p>
      </Card>

      <Card>
        <p className="text-[13px] uppercase tracking-wider text-white/50">Highlights</p>
        <ul className="mt-2 space-y-2 text-[14px] text-white/85">
          <li>• 96 Lighthouse · 1.1s LCP</li>
          <li>• Custom GLSL refractive material</li>
          <li>• 38% lift in conversion vs. previous site</li>
        </ul>
      </Card>
    </AppShell>
  );
}
