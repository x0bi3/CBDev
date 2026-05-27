import { AppShell, Card, Divider, Row } from './AppShell';

export function ContactApp() {
  return (
    <AppShell title="Contact" subtitle="Let's build something memorable.">
      <Card>
        <Row label="Email" value="hello@yourname.dev" href="mailto:hello@yourname.dev" />
        <Divider />
        <Row label="Phone" value="+44 0000 000000" href="tel:+440000000000" />
        <Divider />
        <Row label="LinkedIn" value="@yourname" href="https://linkedin.com" />
        <Divider />
        <Row label="Twitter / X" value="@yourname" href="https://x.com" />
      </Card>

      <Card>
        <p className="mb-3 text-[13px] uppercase tracking-wider text-white/50">Office Hours</p>
        <Row label="Mon — Fri" value="09:00 — 18:00 GMT" />
        <Divider />
        <Row label="Response time" value="< 24 hours" />
      </Card>

      <a
        href="mailto:hello@yourname.dev"
        className="block rounded-2xl bg-white py-4 text-center text-[15px] font-semibold text-black transition active:scale-[0.98]"
      >
        Send a message
      </a>
    </AppShell>
  );
}
