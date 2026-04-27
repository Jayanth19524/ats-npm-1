import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { MapPin, Briefcase, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEmploymentType } from "@/lib/utils";

interface PublicJob {
  id: number;
  title: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  description: string | null;
  organizationId?: number;
  organizationName?: string | null;
  organizationSlug?: string | null;
}

interface Agency {
  id: number;
  slug: string;
  name: string;
  description?: string;
}

export function CareersListPage() {
  const [, params] = useRoute("/careers/:slug");
  const slug = params?.slug;
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);

  useEffect(() => {
    void (async () => {
      if (slug) {
        const a = await fetch(`/api/public/agencies/${slug}`);
        if (a.ok) setAgency(await a.json());
        else {
          setAgency(null);
          setJobs([]);
          return;
        }
        const r = await fetch(`/api/public/agencies/${slug}/jobs`);
        setJobs(r.ok ? await r.json() : []);
      } else {
        const r = await fetch("/api/public/jobs");
        setJobs(r.ok ? await r.json() : []);
      }
    })();
  }, [slug]);

  if (slug && agency === null && jobs?.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            We couldn't find that agency.{" "}
            <Link href="/careers" className="text-primary hover:underline">Browse all roles</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const heading = agency ? `Careers at ${agency.name}` : "Open roles";
  const subtitle = agency
    ? `Explore opportunities at ${agency.name}.`
    : "Explore open positions across our partner agencies.";

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-14">
      <div className="mb-10 text-center">
        {agency && (
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 bg-muted/60 px-3 py-1 rounded-full">
            <Building2 className="w-3.5 h-3.5" /> {agency.name}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{subtitle}</p>
        {agency?.description && (
          <p className="text-sm text-foreground/80 mt-4 max-w-2xl mx-auto whitespace-pre-line">
            {agency.description}
          </p>
        )}
      </div>
      {jobs === null && (
        <div className="text-sm text-muted-foreground text-center">Loading roles...</div>
      )}
      {jobs && jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No open roles right now. Check back soon.
          </CardContent>
        </Card>
      )}
      <div className="space-y-3">
        {jobs?.map((j) => {
          const jobSlug = slug ?? j.organizationSlug;
          const href = jobSlug ? `/careers/${jobSlug}/jobs/${j.id}` : `/careers/jobs/${j.id}`;
          return (
            <Card key={j.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{j.title}</h3>
                    {j.employmentType && (
                     < Badge variant="secondary">{formatEmploymentType(j.employmentType)}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1.5 flex-wrap">
                    {!agency && j.organizationName && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {j.organizationName}
                      </span>
                    )}
                    {j.department && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        {j.department}
                      </span>
                    )}
                    {j.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {j.location}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={href}>
                  <Button>View role</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
