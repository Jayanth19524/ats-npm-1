import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, MapPin, Calendar, Users, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  useListJobs,
  useGetJobStats,
  type ListJobsResponseItem,
} from "@/api-client";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS, formatRelative } from "@/lib/format";

export function JobsPage() {
  useEffect(() => {
    document.title = "Jobs · Pulse";
  }, []);
  const [status, setStatus] = useState<string>("all");
  const jobs = useListJobs(
    status === "all" ? undefined : { status },
  );
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/organization");
      if (r.ok) {
        const o = await r.json();
        setOrgSlug(o.slug);
      }
    })();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Jobs"
        description="Roles your team is currently hiring for."
        actions={
          <>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Link href="/jobs/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New job
              </Button>
            </Link>
          </>
        }
      />
      {jobs.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      )}
      {jobs.data && jobs.data.length === 0 && (
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-1">No jobs yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first role to start tracking candidates.
          </p>
          <Link href="/jobs/new">
            <Button>Create job</Button>
          </Link>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {jobs.data?.map((j) => (
          <JobCard key={j.id} job={j} orgSlug={orgSlug} />
        ))}
      </div>
    </PageContainer>
  );
}

function JobCard({ job, orgSlug }: { job: ListJobsResponseItem; orgSlug: string | null }) {
  const stats = useGetJobStats(job.id, {
    query: { enabled: true },
  });
  const careersUrl = orgSlug
    ? `${window.location.origin}/careers/${orgSlug}/jobs/${job.id}`
    : null;
  return (
    <Link href={`/jobs/${job.id}`}>
      <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer h-full hover-elevate">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{job.title}</h3>
            <div className="text-xs text-muted-foreground mt-0.5">
              {job.department || "—"}
            </div>
          </div>
          <Badge
            variant="outline"
            className={`${STATUS_COLORS[job.status] ?? ""} border-0 capitalize text-xs`}
          >
            {job.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
          {job.description || "No description yet."}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {job.location || "Remote"}
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {stats.data?.totalCandidates ?? "—"} candidates
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Calendar className="w-3.5 h-3.5" />
            {formatRelative(job.createdAt)}
          </div>
        </div>
        {careersUrl && job.status === "open" && (
          <div
            className="mt-3 flex items-center gap-2 text-xs"
            onClick={(e) => e.preventDefault()}
          >
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
            <code className="truncate flex-1 text-muted-foreground">{careersUrl}</code>
            <button
              type="button"
              className="text-primary hover:underline shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void navigator.clipboard.writeText(careersUrl);
                toast.success("Career link copied");
              }}
            >
              Copy
            </button>
          </div>
        )}
      </Card>
    </Link>
  );
}
