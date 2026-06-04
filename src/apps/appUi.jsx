import React from 'react';

export function AppShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-md px-5">
      <h2 className="text-[34px] font-bold leading-tight tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-white/60">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export const Card = ({ children, className = '' }) => (
  <div className={'rounded-2xl border border-white/10 bg-white/[0.08] p-4 ' + className}>{children}</div>
);
