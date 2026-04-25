import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetJob,
  useListStages,
  useGetJobStats,
  useUpdateStage,
  useListTemplates,
  useDeleteJob,
  getListStagesQueryKey,
  getGetJobStatsQueryKey,
  getListJobsQueryKey,
} from "@/api-client";
import { useLocation } from "wouter";
import { ArrowLeft, MapPin, Briefcase, Trash2, Mail, ListChecks } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_COLORS, formatDate } from "@/lib/format";

export function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const id = Number(params?.id);
  const [, navigate] = useLocation();
  const job = useGetJob(id, { query: { enabled: !!id } });
  const stages = useListStages(id, { query: { enabled: !!id } });
  const stats = useGetJobStats(id, { query: { enabled: !!id } });
  const templates = useListTemplates();
  const deleteJob = useDeleteJob();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = job.data ? `${job.data.title} · Pulse` : "Job · Pulse";
  }, [job.data]);

  if (job.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-32 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  if (!job.data) {
    return (
      <PageContainer>
        <Card className="p-12 text-center">
          <h2 className="font-semibold">Job not found</h2>
          <Link href="/jobs">
            <Button variant="ghost" className="mt-4">Back to jobs</Button>
          </Link>
        </Card>
      </PageContainer>
    );
  }

  const j = job.data;
  return (
    <PageContainer>
      <Link href="/jobs">
        <Button variant="ghost" size="sm" className="gap-2 mb-4 -ml-3">
          <ArrowLeft className="w-4 h-4" /> All jobs
        </Button>
      </Link>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight">{j.title}</h1>
            <Badge
              variant="outline"
              className={`${STATUS_COLORS[j.status] ?? ""} border-0 capitalize`}
            >
              {j.status.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" />
              {j.department || "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {j.location || "Remote"}
            </span>
            <span>Created {formatDate(j.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/candidates?jobId=${j.id}`}>
            <Button variant="outline">View candidates</Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (!confirm("Delete this job and all its stages?")) return;
              deleteJob.mutate(
                { id: j.id },
                {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
                    toast.success("Job deleted");
                    navigate("/jobs");
                  },
                },
              );
            }}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold mb-3">About this role</h2>
            {(j.requiredSkills && j.requiredSkills.length > 0) ||
            (typeof j.minExperience === "number" && j.minExperience > 0) ? (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {typeof j.minExperience === "number" && j.minExperience > 0 && (
                  <Badge variant="secondary">
                    {j.minExperience}+ {j.minExperience === 1 ? "year" : "years"} experience
                  </Badge>
                )}
                {j.requiredSkills?.map((skill) => (
                  <Badge key={skill} variant="outline">{skill}</Badge>
                ))}
              </div>
            ) : null}
            {j.description ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: j.description }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No description yet.</p>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Hiring pipeline</h2>
              <p className="text-xs text-muted-foreground">
                Configure automations triggered when a candidate enters a stage.
              </p>
            </div>
            <div className="space-y-3">
              {stages.data?.map((s) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  templates={templates.data ?? []}
                  onUpdated={() => {
                    qc.invalidateQueries({ queryKey: getListStagesQueryKey(j.id) });
                  }}
                />
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 h-fit">
          <h2 className="font-semibold mb-4">Pipeline stats</h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Total candidates</div>
              <div className="text-3xl font-semibold tabular-nums mt-1">
                {stats.data?.totalCandidates ?? "—"}
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              {stats.data?.byStage.map((b) => (
                <div key={b.stageId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{b.stageName}</span>
                  <span className="font-medium tabular-nums">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function StageRow({
  stage,
  templates,
  onUpdated,
}: {
  stage: NonNullable<ReturnType<typeof useListStages>["data"]>[number];
  templates: NonNullable<ReturnType<typeof useListTemplates>["data"]>;
  onUpdated: () => void;
}) {
  const update = useUpdateStage();
  const qc = useQueryClient();

  const patch = (data: Record<string, unknown>) => {
    update.mutate(
      { id: stage.id, data },
      {
        onSuccess: () => {
          onUpdated();
          qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey(stage.jobId) });
        },
      },
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <div className="font-medium">{stage.name}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Send email on entry
            </label>
            <Switch
              checked={stage.sendEmail}
              onCheckedChange={(v) => patch({ sendEmail: v })}
            />
          </div>
          {stage.sendEmail && (
            <Select
              value={stage.templateId ? String(stage.templateId) : ""}
              onValueChange={(v) => patch({ templateId: Number(v) })}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground/80">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              Create task on entry
            </label>
            <Switch
              checked={stage.createTask}
              onCheckedChange={(v) => patch({ createTask: v })}
            />
          </div>
          {stage.createTask && (
            <Input
              defaultValue={stage.taskTitle ?? ""}
              placeholder="Task title (e.g. Schedule onsite)"
              onBlur={(e) =>
                e.target.value !== stage.taskTitle &&
                patch({ taskTitle: e.target.value })
              }
              className="h-9"
            />
          )}
        </div>
      </div>
    </Card>
  );
}
