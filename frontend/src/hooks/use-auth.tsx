import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AuthUser =
  | {
      kind: "staff";
      id: number;
      email: string;
      name: string;
      role: string;
      organizationId?: number;
      organizationName?: string | null;
      organizationSlug?: string | null;
    }
  | { kind: "candidate"; id: number; email: string; name: string; phone: string | null; location: string | null }
  | { kind: null };

interface AuthCtxValue {
  user: AuthUser;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtxValue | null>(null);

async function fetchMe(): Promise<AuthUser> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return { kind: null };
  return (await res.json()) as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>({ kind: null });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const u = await fetchMe();
    setUser(u);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser({ kind: null });
  };

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
