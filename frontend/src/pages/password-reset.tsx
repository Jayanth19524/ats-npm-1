import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function tokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("token") ?? "";
}

function ForgotPasswordCard({
  audienceLabel,
  endpoint,
  backHref,
}: {
  audienceLabel: string;
  endpoint: string;
  backHref: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPreviewUrl(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not send reset email");
        return;
      }
      setMessage(body.message || "If an account exists, a reset link has been sent.");
      setPreviewUrl(typeof body.previewUrl === "string" ? body.previewUrl : null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>Enter your {audienceLabel} email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-foreground">{message}</p>}
          {previewUrl && (
            <p className="text-xs text-muted-foreground break-all">
              Dev preview: <a className="text-primary hover:underline" href={previewUrl}>{previewUrl}</a>
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            <Link href={backHref} className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function ResetPasswordCard({
  endpoint,
  backHref,
}: {
  endpoint: string;
  backHref: string;
}) {
  const [, navigate] = useLocation();
  const token = useMemo(() => tokenFromLocation(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not reset password");
        return;
      }
      navigate(backHref);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Reset password"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            <Link href={backHref} className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function StaffForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <ForgotPasswordCard
          audienceLabel="team"
          endpoint="/api/auth/staff/forgot-password"
          backHref="/login"
        />
      </div>
    </div>
  );
}

export function StaffResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <ResetPasswordCard
          endpoint="/api/auth/staff/reset-password"
          backHref="/login"
        />
      </div>
    </div>
  );
}

export function CandidateForgotPasswordPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <ForgotPasswordCard
        audienceLabel="candidate"
        endpoint="/api/auth/candidate/forgot-password"
        backHref="/careers/login"
      />
    </div>
  );
}

export function CandidateResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <ResetPasswordCard
        endpoint="/api/auth/candidate/reset-password"
        backHref="/careers/login"
      />
    </div>
  );
}
