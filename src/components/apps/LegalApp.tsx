import { AppShell, Card } from './AppShell';

export function LegalApp() {
  return (
    <AppShell title="Legal" subtitle="The boring (but important) stuff.">
      <Card>
        <p className="text-[15px] font-semibold">Privacy Policy</p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          This site collects no personal data, uses no third-party analytics, and
          stores only a single localStorage key for your theme preference.
        </p>
      </Card>

      <Card>
        <p className="text-[15px] font-semibold">Terms of Use</p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          Content is presented &quot;as is&quot;. All trademarks, brand assets, and
          third-party logos are the property of their respective owners.
        </p>
      </Card>

      <Card>
        <p className="text-[15px] font-semibold">Cookies</p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/70">
          None. Genuinely none. Have a biscuit instead. 🍪
        </p>
      </Card>

      <p className="px-2 text-center text-[11px] text-white/40">
        © {new Date().getFullYear()} CreativeBuilds · creativebuilds.dev · All rights reserved.
      </p>
    </AppShell>
  );
}
