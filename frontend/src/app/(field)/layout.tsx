"use client";

import { OperatorShell } from "@/components/layout/OperatorShell";
import { AuthProvider } from "@/lib/auth";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAuth roles={["field_team", "admin"]}>
      <OperatorShell>{children}</OperatorShell>
    </AuthProvider>
  );
}
