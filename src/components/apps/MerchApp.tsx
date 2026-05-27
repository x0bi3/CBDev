import { AppShell, Card } from './AppShell';

const items = [
  { name: 'Hoodie · "Ship It"', price: '£48', color: 'from-rose-500 to-red-800' },
  { name: 'Tee · "console.log"', price: '£22', color: 'from-sky-400 to-blue-800' },
  { name: 'Mug · "404"', price: '£14', color: 'from-amber-400 to-orange-700' },
  { name: 'Sticker pack', price: '£6', color: 'from-emerald-400 to-teal-800' },
];

export function MerchApp() {
  return (
    <AppShell title="Merch" subtitle="Soft cotton. Strong opinions.">
      <div className="grid grid-cols-2 gap-3">
        {items.map((m) => (
          <Card key={m.name} className="!p-0 overflow-hidden">
            <div className={`aspect-square bg-gradient-to-br ${m.color}`} />
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-[13px] font-semibold leading-tight">{m.name}</p>
                <p className="mt-0.5 text-[12px] text-white/60">{m.price}</p>
              </div>
              <button
                type="button"
                className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-black active:scale-95"
              >
                Buy
              </button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
