import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="citizen-shell">
      <header className="citizen-header">
        <div className="citizen-header-inner">
          <Link href="/" className="brand">
            RescueGrid
          </Link>
          <nav className="citizen-nav" aria-label="Citizen">
            <Link href="/report">Report</Link>
            <Link href="/sos" className="nav-sos">
              <span aria-hidden="true">●</span>
              SOS
            </Link>
          </nav>
        </div>
      </header>
      <main className="citizen-main">{children}</main>
    </div>
  );
}
