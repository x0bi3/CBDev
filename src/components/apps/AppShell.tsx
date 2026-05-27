import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared layout for app content — consistent spacing & typography. */
export function AppShell({ title, subtitle, children }: Props) {
  return (
    <div className="mx-auto max-w-md px-5">
      <h2 className="text-[34px] font-bold leading-tight tracking-tight text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-white/60">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
}
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

interface RowProps {
  label: string;
  value: ReactNode;
  href?: string;
}
export function Row({ label, value, href }: RowProps) {
  const inner = (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-[14px] text-white/60">{label}</span>
      <span className="text-right text-[15px] font-medium text-white">{value}</span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-white/5 rounded-lg px-2">
      {inner}
    </a>
  ) : (
    <div className="px-2">{inner}</div>
  );
}

export function Divider() {
  return <div className="h-px bg-white/10" />;
}
