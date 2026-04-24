import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export function LoginPage() {
  const { refresh } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("alex@pulse.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Sign in failed");
        return;
      }
      await refresh();
      navigate("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Pulse</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your team</CardTitle>
            <CardDescription>Recruiters and hiring team members.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Demo accounts: alex@pulse.dev / sam@pulse.dev — password <code>password123</code>
              </p>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-6">
          New agency?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create a workspace
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground mt-2">
          Looking for a job? <Link href="/careers" className="text-primary font-medium hover:underline">Browse open roles</Link>
        </p>
      </div>
    </div>
  );
}
