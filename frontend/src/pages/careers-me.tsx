import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface MyApp {
  id: number;
  jobId: number;
  jobTitle: string | null;
  jobLocation: string | null;
  jobDepartment: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  stageId: number;
  stageName: string | null;
  stageColor: string | null;
  createdAt: string;
}

export function CareersMePage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [apps, setApps] = useState<MyApp[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user.kind !== "candidate") {
      navigate("/careers/login?next=/careers/me");
      return;
    }
    void (async () => {
      const res = await fetch("/api/candidate/applications");
      if (res.ok) setApps(await res.json());
      else setApps([]);
    })();
  }, [user.kind, loading, navigate]);

  if (loading || user.kind !== "candidate") {
    return <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My applications</h1>
      <p className="text-sm text-muted-foreground mt-1">Track where each of your applications stands.</p>
      <div className="mt-6 space-y-3">
        {apps === null && <div className="text-sm text-muted-foreground">Loading...</div>}
        {apps && apps.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            You haven't applied to any roles yet. <Link href="/careers" className="text-primary hover:underline">Browse open roles</Link>
          </CardContent></Card>
        )}
        {apps?.map((a) => (
          <Card key={a.id}>
            <CardContent className="py-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  href={
                    a.organizationSlug
                      ? `/careers/${a.organizationSlug}/jobs/${a.jobId}`
                      : `/careers/jobs/${a.jobId}`
                  }
                  className="font-semibold hover:underline"
                >
                  {a.jobTitle ?? "Job"}
                </Link>
                <div className="text-sm text-muted-foreground mt-1">
                  {[a.organizationName, a.jobDepartment, a.jobLocation].filter(Boolean).join(" · ")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Applied {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </div>
              <Badge
                style={a.stageColor ? { backgroundColor: a.stageColor, color: "white" } : undefined}
                variant="secondary"
              >
                {a.stageName ?? "In review"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
