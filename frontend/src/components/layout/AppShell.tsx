import { type ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CheckSquare,
  Gift,
  BarChart3,
  Settings,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewerSwitcher } from "./ViewerSwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  // { href: "/tasks", label: "Tasks", icon: CheckSquare },
  // { href: "/referrals", label: "Referrals", icon: Gift },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform md:static md:translate-x-0 md:flex",
          mobileOpen ? "translate-x-0 flex" : "-translate-x-full",
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold tracking-tight text-base text-white">Pulse</span>
          </Link>
          <button
            className="md:hidden text-sidebar-foreground/70 hover:text-white"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-white font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white",
                )}
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <ViewerSwitcher />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center px-4 md:px-8 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
          <button
            className="md:hidden mr-3 p-2 -ml-2 text-muted-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <PageBreadcrumb />
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function PageBreadcrumb() {
  const [location] = useLocation();
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/jobs": "Jobs",
    "/jobs/new": "New job",
    "/candidates": "Candidates",
    "/candidates/new": "Add candidate",
    "/tasks": "Tasks",
    "/referrals": "Referrals",
    "/reports": "Reports",
    "/settings": "Settings",
  };
  let label = map[location];
  if (!label) {
    if (location.startsWith("/jobs/")) label = "Job detail";
    else label = "Pulse";
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Pulse</span>
      <span className="text-muted-foreground/50">/</span>
      <span className="font-medium text-foreground">{label}</span>
    </div>
  );
}
