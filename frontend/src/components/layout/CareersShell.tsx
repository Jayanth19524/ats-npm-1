import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function CareersShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const slugMatch = location.match(/^\/careers\/([^/]+)(?:\/.*)?$/);
  const reserved = new Set(["login", "signup", "me", "jobs"]);
  const slug = slugMatch && !reserved.has(slugMatch[1]) ? slugMatch[1] : null;
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const careersHome = slug ? `/careers/${slug}` : "/careers";

  useEffect(() => {
    if (!slug) {
      setAgencyName(null);
      return;
    }
    void (async () => {
      const r = await fetch(`/api/public/agencies/${slug}`);
      if (r.ok) {
        const a = await r.json();
        setAgencyName(a.name);
        document.title = `${a.name} · Careers`;
      } else {
        setAgencyName(null);
      }
    })();
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto h-16 px-4 md:px-6 flex items-center justify-between">
          <Link href={careersHome} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">{agencyName ?? "Pulse"}</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">Careers</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href={careersHome} className="text-sm px-3 py-1.5 rounded-md hover:bg-muted">Open roles</Link>
            {user.kind === "candidate" ? (
              <>
                <Link href="/careers/me" className="text-sm px-3 py-1.5 rounded-md hover:bg-muted">My applications</Link>
                <span className="hidden sm:inline text-sm text-muted-foreground ml-2">{user.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await logout();
                    navigate("/careers");
                  }}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Link href="/careers/login">
                  <Button size="sm" variant="ghost">Sign in</Button>
                </Link>
                <Link href="/careers/signup">
                  <Button size="sm">Create account</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Pulse Careers · Recruiter? <Link href="/login" className="hover:underline">Sign in here</Link>
      </footer>
    </div>
  );
}
