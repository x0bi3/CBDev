import { AppShell, Card } from './AppShell';

const work = [
  { name: 'Orbital Bank', tag: 'Fintech · 2024', color: 'from-indigo-500 to-fuchsia-600' },
  { name: 'Nimbus CMS', tag: 'SaaS · 2023', color: 'from-emerald-400 to-cyan-700' },
  { name: 'Atlas Travel', tag: 'WebGL · 2023', color: 'from-amber-400 to-rose-600' },
  { name: 'Helix Studio', tag: 'Agency · 2022', color: 'from-violet-500 to-purple-900' },
];

export function PortfolioApp() {
  return (
    <AppShell title="Portfolio" subtitle="A small selection of recent work.">
      <div className="grid grid-cols-2 gap-3">
        {work.map((p) => (
          <Card key={p.name} className="!p-0 overflow-hidden">
            <div className={`aspect-[4/3] bg-gradient-to-br ${p.color}`} />
            <div className="p-3">
              <p className="text-[14px] font-semibold">{p.name}</p>
              <p className="text-[11px] text-white/60">{p.tag}</p>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
