"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/** Admin-only gate using the parent ops AuthProvider (no nested provider). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/login?error=unauthorized");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="ops-loading">Checking session…</div>;
  }
  if (user.role !== "admin") {
    return <div className="ops-loading">Redirecting…</div>;
  }

  return <div className="h-full min-h-0 overflow-y-auto">{children}</div>;
}
