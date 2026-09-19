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
import {
  ApiError,
  getMe,
  login as apiLogin,
  refreshTokens as apiRefresh,
  type UserPublic,
} from "@/lib/api/client";

const ACCESS_KEY = "rg_access_token";
const REFRESH_KEY = "rg_refresh_token";
const AUTH_COOKIE = "rg_auth";
const ROLE_COOKIE = "rg_role";

type AuthContextValue = {
  user: UserPublic | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserPublic>;
  logout: () => void;
  getToken: () => string | null;
  refreshSession: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let refreshInFlight: Promise<string | null> | null = null;

function setSessionCookies(role: string) {
  const maxAge = 60 * 60 * 12;
  document.cookie = `${AUTH_COOKIE}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearSessionCookies() {
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

/** Attempt one refresh; coalesces concurrent callers. Returns new access token or null. */
export async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = getStoredRefreshToken();
    if (!refresh) return null;
    try {
      const tokens = await apiRefresh(refresh);
      localStorage.setItem(ACCESS_KEY, tokens.access_token);
      localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
      return tokens.access_token;
    } catch {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      clearSessionCookies();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
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

  const applyUser = useCallback((me: UserPublic, token: string) => {
    setUser(me);
    setAccessToken(token);
    setSessionCookies(me.role);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    clearSessionCookies();
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = await tryRefreshAccessToken();
    if (!token) {
      clearSession();
      return null;
    }
    try {
      const me = await getMe(token);
      applyUser(me, token);
      return token;
    } catch {
      clearSession();
      return null;
    }
  }, [applyUser, clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = getStoredAccessToken();
      if (!token) {
        clearSessionCookies();
        if (!cancelled) setLoading(false);
        return;
      }
      setAccessToken(token);
      try {
        const me = await getMe(token);
        if (!cancelled) applyUser(me, token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          const refreshed = await tryRefreshAccessToken();
          if (refreshed) {
            try {
              const me = await getMe(refreshed);
              if (!cancelled) applyUser(me, refreshed);
              return;
            } catch {
              /* fall through */
            }
          }
        }
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyUser, clearSession]);

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

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await apiLogin(email, password);
      localStorage.setItem(ACCESS_KEY, tokens.access_token);
      localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
      const me = await getMe(tokens.access_token);
      applyUser(me, tokens.access_token);
      return me;
    },
    [applyUser],
  );

  const logout = useCallback(() => {
    clearSession();
    router.push("/login");
  }, [clearSession, router]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      logout,
      getToken: () => accessToken ?? getStoredAccessToken(),
      refreshSession,
    }),
    [user, accessToken, loading, login, logout, refreshSession],
  );

  if (requireAuth && loading) {
    return <div className="ops-loading">Checking session…</div>;
  }
  if (requireAuth && !user) {
    return <div className="ops-loading">Redirecting to login…</div>;
  }
  if (requireAuth && roles && user && !roles.includes(user.role)) {
    return <div className="ops-loading">Redirecting…</div>;
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

/** Run an authenticated call; on 401 refresh once and retry. */
export async function withAuthRetry<T>(
  getToken: () => string | null,
  refreshSession: () => Promise<string | null>,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const token = getToken();
  if (!token) throw new ApiError(401, "unauthorized", "Not signed in");
  try {
    return await fn(token);
  } catch (err) {
    if (!isApiUnauthorized(err)) throw err;
    const next = await refreshSession();
    if (!next) throw err;
    return fn(next);
  }
}
