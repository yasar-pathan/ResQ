"use client";

import { OperatorShell } from "@/components/layout/OperatorShell";
import { AuthProvider } from "@/lib/auth";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAuth roles={["dispatcher", "admin"]}>
      <OperatorShell>{children}</OperatorShell>
    </AuthProvider>
  );
}
