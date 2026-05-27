import { useEffect, useState } from 'react';

interface Props {
  light?: boolean;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function format(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const am = h < 12;
  h = h % 12 || 12;
  return `${h}:${m}${am ? '' : ''}`;
}

export function StatusBar({ light = true }: Props) {
  const now = useClock();
  const fg = light ? 'text-white' : 'text-black';

  return (
    <div className={`flex items-center justify-between px-7 text-[15px] font-semibold ${fg}`}>
      <span className="tabular-nums">{format(now)}</span>

      {/* Dynamic Island placeholder — visual only */}
      <div className="h-[26px] w-[110px] rounded-full bg-black/90 shadow-inner ring-1 ring-white/10" />

      <div className="flex items-center gap-1.5">
        {/* Signal */}
        <svg viewBox="0 0 18 12" className="h-3 w-4" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2" width="3" height="10" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        {/* Wifi */}
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill="currentColor">
          <path d="M8 11.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm-3.6-3.5a5 5 0 0 1 7.2 0l1.4-1.4a7 7 0 0 0-10 0l1.4 1.4ZM1.6 4.5a9 9 0 0 1 12.8 0L15.8 3a11 11 0 0 0-15.6 0l1.4 1.5Z" />
        </svg>
        {/* Battery */}
        <div className="flex items-center">
          <div className="relative h-[12px] w-[24px] rounded-[3px] border border-current/80">
            <div className="absolute inset-[1.5px] rounded-[1.5px] bg-current" style={{ width: '74%' }} />
          </div>
          <div className="h-[5px] w-[1.5px] rounded-r bg-current/80 ml-px" />
        </div>
      </div>
    </div>
  );
}
