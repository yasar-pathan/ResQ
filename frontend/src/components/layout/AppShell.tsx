"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideChrome = pathname === "/";

  return (
    <div className={`citizen-shell${hideChrome ? " citizen-shell-bare" : ""}`}>
      {!hideChrome ? (
        <header className="citizen-header">
          <div className="citizen-header-inner">
            <BrandMark href="/" size={40} />
            <nav className="citizen-nav" aria-label="Citizen">
              <Link href="/report" className="nav-link">
                <FileText size={18} aria-hidden />
                Report
              </Link>
              <Link href="/sos" className="nav-sos">
                <AlertTriangle size={18} aria-hidden />
                SOS
              </Link>
            </nav>
          </div>
        </header>
      ) : null}
      <main className="citizen-main">{children}</main>
    </div>
  );
}
