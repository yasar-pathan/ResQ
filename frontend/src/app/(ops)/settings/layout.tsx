"use client";

import { AuthProvider } from "@/lib/auth";

/** Admin-only gate nested under ops shell (dispatchers are redirected). */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAuth roles={["admin"]}>
      {children}
    </AuthProvider>
  );
}
