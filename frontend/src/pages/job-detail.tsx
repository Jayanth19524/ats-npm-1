import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetJob,
  useListStages,
  useGetJobStats,
  useUpdateStage,
  useDeleteStage,
  useCreateStage,
  useListTemplates,
  useDeleteJob,
  useUpdateJob,
  getGetJobQueryKey,
  getListStagesQueryKey,
  getGetJobStatsQueryKey,
  getListJobsQueryKey,
} from "@/api-client";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Trash2,
  Mail,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_COLORS, formatDate } from "@/lib/format";
import { formatEmploymentType } from "@/lib/utils";
import { ApplicationFormEditor } from "@/components/ApplicationFormEditor";
import { RichTextEditor } from "@/components/RichTextEditor";

const NEW_STAGE_DEFAULT_COLOR = "#6366f1";

export function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const id = Number(params?.id);
  const [, navigate] = useLocation();
  const job = useGetJob(id, { query: { enabled: !!id } });
  const stages = useListStages(id, { query: { enabled: !!id } });
  const stats = useGetJobStats(id, { query: { enabled: !!id } });
  const templates = useListTemplates();
  const deleteJob = useDeleteJob();
  const updateJob = useUpdateJob();
  const createStage = useCreateStage();
  const qc = useQueryClient();
  const [newStageName, setNewStageName] = useState("");
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(false);
  const [editJobOpen, setEditJobOpen] = useState(false);

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

  const refreshStages = () => {
    qc.invalidateQueries({ queryKey: getListStagesQueryKey(j.id) });
    qc.invalidateQueries({ queryKey: getGetJobStatsQueryKey(j.id) });
  };

  const handleAddStage = async () => {
    const name = newStageName.trim();
    if (!name) return;
    try {
      await createStage.mutateAsync({
        jobId: j.id,
        data: {
          name,
          color: NEW_STAGE_DEFAULT_COLOR,
          sendEmail: false,
          createTask: false,
        },
      });
      setNewStageName("");
      refreshStages();
    } catch {
      toast.error("Could not add the stage. Please try again.");
    }
  };

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
            <Select
              value={j.status}
              onValueChange={(v) => {
                const next = v as "draft" | "open" | "on_hold" | "closed";
                updateJob.mutate(
                  { id: j.id, data: { status: next } },
                  {
                    onSuccess: () => {
                      qc.invalidateQueries({ queryKey: getGetJobQueryKey(j.id) });
                      qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
                      const labels: Record<string, string> = {
                        draft: "Draft",
                        open: "Open",
                        on_hold: "On hold",
                        closed: "Closed",
                      };
                      toast.success(`Status set to ${labels[next] ?? next}`);
                    },
                    onError: () => toast.error("Could not update status"),
                  },
                );
              }}
            >
              <SelectTrigger
                className={`h-7 w-auto gap-1.5 border-0 px-2.5 capitalize ${
                  STATUS_COLORS[j.status] ?? ""
                }`}
                aria-label="Change job status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
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
            onClick={() => setConfirmDeleteJob(true)}
            aria-label="Delete job"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <AlertDialog open={confirmDeleteJob} onOpenChange={setConfirmDeleteJob}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{j.title}" and all its pipeline stages will be removed. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() =>
                    deleteJob.mutate(
                      { id: j.id },
                      {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
                          toast.success("Job deleted");
                          navigate("/jobs");
                        },
                        onError: () =>
                          toast.error("Could not delete this job."),
                      },
                    )
                  }
                >
                  Delete job
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="font-semibold">About this role</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatEmploymentType(j.employmentType)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditJobOpen(true)}
                className="gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            </div>
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

          <EditJobDialog
            key={`edit-${j.id}-${editJobOpen}`}
            open={editJobOpen}
            onOpenChange={setEditJobOpen}
            job={j}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: getGetJobQueryKey(j.id) });
              qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
            }}
          />

          <Card className="p-6">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h2 className="font-semibold">Hiring pipeline</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rename, recolor, add or remove stages, and configure automations.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {stages.data?.map((s) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  templates={templates.data ?? []}
                  onChanged={refreshStages}
                />
              ))}
              {stages.data && stages.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No stages yet — add the first one below.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Input
                placeholder="Add a stage (e.g. Phone screen)"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddStage();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddStage}
                disabled={createStage.isPending || !newStageName.trim()}
                className="gap-1"
              >
                <Plus className="w-4 h-4" /> Add stage
              </Button>
            </div>
          </Card>

          <ApplicationFormEditor jobId={j.id} />
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
  onChanged,
}: {
  stage: NonNullable<ReturnType<typeof useListStages>["data"]>[number];
  templates: NonNullable<ReturnType<typeof useListTemplates>["data"]>;
  onChanged: () => void;
}) {
  const update = useUpdateStage();
  const deleteStage = useDeleteStage();
  const [name, setName] = useState(stage.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep local name in sync if the stage is reloaded with a new value.
  useEffect(() => {
    setName(stage.name);
  }, [stage.name]);

  const patch = (data: Record<string, unknown>) => {
    update.mutate(
      { id: stage.id, data },
      {
        onSuccess: () => onChanged(),
      },
    );
  };

  const handleConfirmDelete = () => {
    deleteStage.mutate(
      { id: stage.id },
      {
        onSuccess: () => {
          toast.success(`Stage "${stage.name}" deleted`);
          onChanged();
        },
        onError: () => toast.error("Could not delete this stage."),
      },
    );
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(stage.name);
      return;
    }
    if (trimmed !== stage.name) patch({ name: trimmed });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <input
          type="color"
          value={stage.color}
          onChange={(e) => patch({ color: e.target.value })}
          className="w-7 h-7 rounded border border-border cursor-pointer"
          aria-label={`Color for ${stage.name}`}
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="font-medium h-9 max-w-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => setConfirmDelete(true)}
          aria-label={`Delete ${stage.name}`}
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </Button>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this stage?</AlertDialogTitle>
              <AlertDialogDescription>
                The "{stage.name}" stage will be removed from this job's
                pipeline. Any candidates currently in this stage will need to be
                moved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirmDelete}
              >
                Delete stage
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="text-sm">
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
        {/*
          "Create task on entry" automation is intentionally hidden for now.
          Re-enable by restoring the block below and re-importing ListChecks
          from lucide-react.

          <div className="space-y-2 mt-4">
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
        */}
      </div>
    </Card>
  );
}

type JobForEdit = NonNullable<ReturnType<typeof useGetJob>["data"]>;

function EditJobDialog({
  open,
  onOpenChange,
  job,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  job: JobForEdit;
  onSaved: () => void;
}) {
  const updateJob = useUpdateJob();
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department ?? "");
  const [location, setLocation] = useState(job.location ?? "");
  const [employmentType, setEmploymentType] = useState(
    job.employmentType ?? "full_time",
  );
  const [description, setDescription] = useState(job.description ?? "");
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    job.requiredSkills ?? [],
  );
  const [skillInput, setSkillInput] = useState("");
  const [minExperience, setMinExperience] = useState<string>(
    typeof job.minExperience === "number" ? String(job.minExperience) : "",
  );

  const addSkill = () => {
    const value = skillInput.trim();
    if (!value) return;
    if (requiredSkills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillInput("");
      return;
    }
    setRequiredSkills([...requiredSkills, value]);
    setSkillInput("");
  };
  const removeSkill = (skill: string) =>
    setRequiredSkills(requiredSkills.filter((s) => s !== skill));

  const onSave = () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      toast.error("Title must be at least 2 characters.");
      return;
    }
    let parsedExp: number | null = null;
    if (minExperience.trim() !== "") {
      const n = Number(minExperience);
      if (!Number.isInteger(n) || n < 0 || n > 60) {
        toast.error("Minimum experience must be a whole number between 0 and 60.");
        return;
      }
      parsedExp = n;
    }
    updateJob.mutate(
      {
        id: job.id,
        data: {
          title: trimmedTitle,
          department: department.trim(),
          location: location.trim(),
          employmentType,
          description,
          requiredSkills,
          minExperience: parsedExp,
        },
      },
      {
        onSuccess: () => {
          toast.success("Job details updated");
          onSaved();
          onOpenChange(false);
        },
        onError: () => toast.error("Could not save changes. Please try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit job details</DialogTitle>
          <DialogDescription>
            Update the role information shown to your team and on the public
            careers page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Job title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Product Designer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Design"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Employment type</Label>
              <Select
                value={employmentType}
                onValueChange={(v) => setEmploymentType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Minimum years of experience
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Required skills</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill();
                  } else if (
                    e.key === "Backspace" &&
                    skillInput === "" &&
                    requiredSkills.length > 0
                  ) {
                    removeSkill(requiredSkills[requiredSkills.length - 1]);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                Add
              </Button>
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {requiredSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button
                      type="button"
                      aria-label={`Remove ${skill}`}
                      onClick={() => removeSkill(skill)}
                      className="rounded hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Description</Label>
            <RichTextEditor
              value={description}
              onChange={(html) => setDescription(html)}
              placeholder="What does this role do? Who's the ideal candidate?"
            />
            <p className="text-xs text-muted-foreground">
              Shown to candidates on the public job page.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updateJob.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={updateJob.isPending}
          >
            {updateJob.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
