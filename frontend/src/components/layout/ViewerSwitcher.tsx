import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function ViewerSwitcher() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  if (user.kind !== "staff") return null;

  return (
    <div className="space-y-2">
      <div className="px-2">
        <div className="text-sm font-medium text-white truncate">{user.name}</div>
        <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
        <div className="text-[11px] text-sidebar-foreground/50 mt-0.5 capitalize">{user.role.replace("_", " ")}</div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-white"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign out
      </Button>
    </div>
  );
}
