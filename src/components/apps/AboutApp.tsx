import { AppShell, Card, Divider, Row } from './AppShell';

export function AboutApp() {
  return (
    <AppShell title="About" subtitle="Hi, I'm a developer who turns ideas into immersive web.">
      <Card>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-700 text-2xl font-bold">
            YN
          </div>
          <div>
            <p className="text-[17px] font-semibold">Ryan · CreativeBuilds</p>
            <p className="text-[13px] text-white/60">Software Builder · U.S.</p>
          </div>
        </div>
      </Card>

      <Card>
        <Row label="Role" value="Senior Frontend Engineer" />
        <Divider />
        <Row label="Stack" value="React · TS · Three.js" />
        <Divider />
        <Row label="Years" value="8+" />
        <Divider />
        <Row label="Location" value="London, UK" />
      </Card>

      <Card>
        <p className="text-[14px] leading-relaxed text-white/80">
          I build bold, cinematic web experiences with enterprise-grade polish.
          Specialising in WebGL, complex animation choreography, and design systems
          that scale across product teams.
        </p>
      </Card>
    </AppShell>
  );
}
