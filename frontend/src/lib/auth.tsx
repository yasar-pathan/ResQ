"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, getMe, login as apiLogin, type UserPublic } from "@/lib/api/client";

const ACCESS_KEY = "rg_access_token";
const REFRESH_KEY = "rg_refresh_token";

type AuthContextValue = {
  user: UserPublic | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserPublic>;
  logout: () => void;
  getToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function AuthProvider({
  children,
  requireAuth = false,
  roles,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  roles?: string[];
}) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAccessToken(token);
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !requireAuth) return;
    if (!user) {
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/login?error=unauthorized");
    }
  }, [loading, requireAuth, user, roles, router, pathname]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await apiLogin(email, password);
    localStorage.setItem(ACCESS_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    setAccessToken(tokens.access_token);
    const me = await getMe(tokens.access_token);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setAccessToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      logout,
      getToken: () => accessToken ?? getStoredAccessToken(),
    }),
    [user, accessToken, loading, login, logout],
  );

  if (requireAuth && loading) {
    return <div className="ops-loading">Checking session…</div>;
  }
  if (requireAuth && !user) {
    return <div className="ops-loading">Redirecting to login…</div>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function isApiUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
